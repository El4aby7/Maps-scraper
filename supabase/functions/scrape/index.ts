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

    let lat: number, lon: number
    let radiusInMeters: number

    // Resolve location and radius
    if (bbox && bbox.length === 4) {
      const [minLat, minLon, maxLat, maxLon] = bbox
      lat = (minLat + maxLat) / 2
      lon = (minLon + maxLon) / 2
      
      // Calculate radius as distance from center to max corner in meters
      const dLat = (maxLat - lat) * 111000
      const dLon = (maxLon - lon) * 111000 * Math.cos((lat * Math.PI) / 180)
      radiusInMeters = Math.floor(Math.sqrt(dLat * dLat + dLon * dLon))
    } else if (mapCenter && mapCenter.length === 2) {
      lat = mapCenter[0]
      lon = mapCenter[1]
      radiusInMeters = Math.floor(radius * 1000)
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
      lat = loc.lat
      lon = loc.lng
      radiusInMeters = Math.floor(radius * 1000)
    }

    // Build Places Nearby Search URL
    let searchUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lon}&radius=${radiusInMeters}&key=${GOOGLE_MAPS_API_KEY}`
    const catLower = (category as string).toLowerCase().trim()
    if (category && catLower !== 'all categories') {
      searchUrl += `&keyword=${encodeURIComponent(category)}`
    } else {
      searchUrl += `&type=establishment`
    }

    // Fetch places (handling next page token pagination)
    let allPlaces: any[] = []
    let currentUrl = searchUrl
    let pagesFetched = 0
    const maxResults = typeof limit === 'number' && limit > 0 ? limit : 500

    while (currentUrl && allPlaces.length < maxResults && pagesFetched < 3) {
      console.log(`Fetching from Google Places (page ${pagesFetched + 1})...`)
      const res = await fetch(currentUrl)
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Google Places search failed: ${res.status} - ${text}`)
      }

      const data = await res.json()
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        throw new Error(`Google Places API returned status: ${data.status}. Message: ${data.error_message || 'None'}`)
      }

      if (data.results) {
        allPlaces = allPlaces.concat(data.results)
      }

      pagesFetched++
      if (data.next_page_token && allPlaces.length < maxResults && pagesFetched < 3) {
        // The token requires a short delay before it becomes valid/active
        await new Promise(resolve => setTimeout(resolve, 2000))
        currentUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${data.next_page_token}&key=${GOOGLE_MAPS_API_KEY}`
      } else {
        currentUrl = ''
      }
    }

    const placesToFetch = allPlaces.slice(0, maxResults)
    console.log(`Found ${placesToFetch.length} total places. Fetching details...`)

    // Fetch rich details (phone and website) for each place in parallel batches
    const batchSize = 10
    const results: any[] = []

    for (let i = 0; i < placesToFetch.length; i += batchSize) {
      const batch = placesToFetch.slice(i, i + batchSize)
      const batchPromises = batch.map(async (place) => {
        try {
          const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_address,international_phone_number,website,geometry,types&key=${GOOGLE_MAPS_API_KEY}`
          const detailRes = await fetch(detailUrl)
          if (detailRes.ok) {
            const detailData = await detailRes.json()
            if (detailData.status === 'OK' && detailData.result) {
              const r = detailData.result
              return {
                id: place.place_id,
                name: r.name || place.name,
                address: r.formatted_address || place.vicinity || `${r.geometry?.location?.lat.toFixed(5)}, ${r.geometry?.location?.lng.toFixed(5)}`,
                phone: r.international_phone_number || 'N/A',
                website: r.website || undefined,
                category: r.types && r.types.length > 0 ? r.types[0].replace(/_/g, ' ') : category,
                lat: r.geometry?.location?.lat ?? place.geometry?.location?.lat ?? lat,
                lon: r.geometry?.location?.lng ?? place.geometry?.location?.lng ?? lon,
              }
            }
          }
        } catch (err) {
          console.error(`Failed to fetch details for place ${place.place_id}:`, err)
        }

        // Fallback basic mapping if detail fetch fails
        return {
          id: place.place_id,
          name: place.name,
          address: place.vicinity || `${place.geometry?.location?.lat.toFixed(5)}, ${place.geometry?.location?.lng.toFixed(5)}`,
          phone: 'N/A',
          website: undefined,
          category: place.types && place.types.length > 0 ? place.types[0].replace(/_/g, ' ') : category,
          lat: place.geometry?.location?.lat ?? lat,
          lon: place.geometry?.location?.lng ?? lon,
        }
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
    }

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
