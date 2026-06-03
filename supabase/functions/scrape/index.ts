import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY') || 'AIzaSyCi27W3gsYHMXHT050oUPc-hiwEfke4Xsk';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { location, category, radius, limit, mapCenter, requiredFields, bbox } = await req.json()

    let minLat: number, minLon: number, maxLat: number, maxLon: number

    // Resolve location and bounding box coordinates
    if (bbox && bbox.length === 4) {
      [minLat, minLon, maxLat, maxLon] = bbox
    } else if (mapCenter && mapCenter.length === 2) {
      const cLat = mapCenter[0]
      const cLon = mapCenter[1]
      const rKm = radius || 15

      // Approximate bounding box of a circle (1 degree of latitude is ~111km)
      const latOffset = rKm / 111
      const lonOffset = rKm / (111 * Math.cos((cLat * Math.PI) / 180))

      minLat = cLat - latOffset
      maxLat = cLat + latOffset
      minLon = cLon - lonOffset
      maxLon = cLon + lonOffset
    } else {
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${GOOGLE_MAPS_API_KEY}`
      const geoResponse = await fetch(geocodeUrl)
      if (!geoResponse.ok) {
        const text = await geoResponse.text()
        throw new Error(`Failed to geocode location: ${geoResponse.status} - ${text}`)
      }
      const geoData = await geoResponse.json()
      if (!geoData.results || geoData.results.length === 0) {
        throw new Error(`Location not found: ${location}`)
      }
      const loc = geoData.results[0].geometry.location
      const cLat = loc.lat
      const cLon = loc.lng
      const rKm = radius || 15

      const latOffset = rKm / 111
      const lonOffset = rKm / (111 * Math.cos((cLat * Math.PI) / 180))

      minLat = cLat - latOffset
      maxLat = cLat + latOffset
      minLon = cLon - lonOffset
      maxLon = cLon + lonOffset
    }

    // Build the query text string for Text Search (New)
    const categoryQuery = category && category.toLowerCase().trim() !== 'all categories' ? category : 'establishments'
    let queryText = categoryQuery

    // Only append location to the query if it is a real place name and we are not using coordinate restrictions
    if (location && !location.startsWith('Selection:') && !/^\d/.test(location.trim())) {
      if (!bbox && !mapCenter) {
        queryText = `${categoryQuery} in ${location}`
      }
    }

    // Fetch places (handling pagination)
    let allPlaces: any[] = []
    let pageToken: string | null = null
    let pagesFetched = 0
    const maxResults = typeof limit === 'number' && limit > 0 ? limit : 60

    do {
      const requestBody: any = {
        textQuery: queryText,
        locationRestriction: {
          rectangle: {
            low: { latitude: minLat, longitude: minLon },
            high: { latitude: maxLat, longitude: maxLon }
          }
        }
      }

      if (pageToken) {
        requestBody.pageToken = pageToken
      }

      console.log(`Fetching page ${pagesFetched + 1} of Places API (New) Text Search...`)
      const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.internationalPhoneNumber,places.websiteUri,places.types,nextPageToken'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`Google Places Text Search failed: ${response.status} - ${errText}`)
      }

      const data = await response.json()
      if (data.places) {
        allPlaces = allPlaces.concat(data.places)
      }

      pageToken = data.nextPageToken || null
      pagesFetched++

      // Wait a moment between requests to avoid rate limits
      if (pageToken && allPlaces.length < maxResults && pagesFetched < 3) {
        await new Promise(resolve => setTimeout(resolve, 500))
      } else {
        pageToken = null
      }
    } while (pageToken)

    // Map new Place objects directly to the DB schema
    const results = allPlaces.slice(0, maxResults).map((place) => {
      return {
        id: place.id,
        name: place.displayName?.text || 'Unknown Business',
        address: place.formattedAddress || 'No Address Provided',
        phone: place.internationalPhoneNumber || 'N/A',
        website: place.websiteUri || undefined,
        category: place.types && place.types.length > 0 ? place.types[0].replace(/_/g, ' ') : category,
        lat: place.location?.latitude ?? minLat,
        lon: place.location?.longitude ?? minLon,
      }
    })

    // Save to DB (best-effort)
    let sessionId: string | null = null
    try {
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )
      const { data: session, error: sessionErr } = await supabaseAdmin
        .from('scraping_sessions')
        .insert({ location, category, radius_km: radius, result_count: results.length })
        .select('id')
        .single()

      if (!sessionErr && session) {
        sessionId = session.id
        if (results.length > 0) {
          await supabaseAdmin.from('scraped_results').insert(
            results.map((r) => ({
              id: r.id,
              session_id: session.id,
              name: r.name,
              category: r.category,
              address: r.address,
              phone: r.phone,
              website: r.website ?? null,
              lat: r.lat,
              lon: r.lon,
            }))
          )
        }
      }
    } catch (dbErr) {
      console.error('DB save failed (non-fatal):', dbErr)
    }

    console.log(`Returning ${results.length} results`)

    return new Response(
      JSON.stringify({ session_id: sessionId, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    const errObj = error as Error
    console.error('Scraping error:', errObj)
    return new Response(
      JSON.stringify({ error: errObj.message || String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
