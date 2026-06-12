import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY')!;

const PLACE_FIELDS = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.types',
  'places.googleMapsUri',
  'places.rating',
  'places.userRatingCount',
  'places.regularOpeningHours.weekdayDescriptions',
  'places.businessStatus',
].join(',')

// Businesses often list a social profile as their "website" in Google.
// Classify the URL so socials are surfaced separately from real websites.
const SOCIAL_PLATFORMS: { key: string; pattern: RegExp }[] = [
  { key: 'facebook', pattern: /(?:^|\.)(?:facebook\.com|fb\.com|fb\.me)$/i },
  { key: 'instagram', pattern: /(?:^|\.)instagram\.com$/i },
  { key: 'tiktok', pattern: /(?:^|\.)tiktok\.com$/i },
  { key: 'x', pattern: /(?:^|\.)(?:twitter\.com|x\.com)$/i },
  { key: 'linkedin', pattern: /(?:^|\.)linkedin\.com$/i },
  { key: 'youtube', pattern: /(?:^|\.)(?:youtube\.com|youtu\.be)$/i },
  { key: 'whatsapp', pattern: /(?:^|\.)(?:wa\.me|whatsapp\.com)$/i },
]

function classifyWebsite(url?: string): { website?: string; socials: Record<string, string> } {
  const socials: Record<string, string> = {}
  if (!url) return { website: undefined, socials }
  try {
    const hostname = new URL(url).hostname
    for (const { key, pattern } of SOCIAL_PLATFORMS) {
      if (pattern.test(hostname)) {
        socials[key] = url
        return { website: undefined, socials }
      }
    }
  } catch {
    // Not a parseable URL — keep it as a plain website string
  }
  return { website: url, socials }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { location, category, radius, limit, mapCenter, requiredFields, bbox } = await req.json()

    let minLat: number, minLon: number, maxLat: number, maxLon: number
    let centerLat: number, centerLon: number
    let radiusInMeters: number

    // Resolve location and bounding box coordinates
    if (bbox && bbox.length === 4) {
      [minLat, minLon, maxLat, maxLon] = bbox
      centerLat = (minLat + maxLat) / 2
      centerLon = (minLon + maxLon) / 2
      
      // Distance in meters between center and corner (approximate)
      const latDiff = Math.abs(maxLat - centerLat)
      const lonDiff = Math.abs(maxLon - centerLon)
      const kmDiff = Math.sqrt((latDiff * 111) ** 2 + (lonDiff * (111 * Math.cos((centerLat * Math.PI) / 180))) ** 2)
      radiusInMeters = Math.max(100, Math.floor(kmDiff * 1000))
    } else if (mapCenter && mapCenter.length === 2) {
      centerLat = mapCenter[0]
      centerLon = mapCenter[1]
      radiusInMeters = Math.max(100, Math.floor((radius || 15) * 1000))
      
      const latOffset = (radius || 15) / 111
      const lonOffset = (radius || 15) / (111 * Math.cos((centerLat * Math.PI) / 180))
      minLat = centerLat - latOffset
      maxLat = centerLat + latOffset
      minLon = centerLon - lonOffset
      maxLon = centerLon + lonOffset
    } else {
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${GOOGLE_MAPS_API_KEY}`
      const geoResponse = await fetch(geocodeUrl)
      if (!geoResponse.ok) {
        const text = await geoResponse.text()
        throw new Error(`Failed to geocode location: ${geoResponse.status} - ${text}`)
      }
      const geoData = await geoResponse.json()
      // Geocoding returns HTTP 200 even on auth failures; the real outcome is in `status`.
      // REQUEST_DENIED here usually means the key lacks the Geocoding API or is referrer-restricted.
      if (geoData.status && geoData.status !== 'OK') {
        throw new Error(
          `Geocoding failed (${geoData.status}): ${geoData.error_message || `could not resolve "${location}"`}`
        )
      }
      if (!geoData.results || geoData.results.length === 0) {
        throw new Error(`Location not found: ${location}`)
      }
      const loc = geoData.results[0].geometry.location
      centerLat = loc.lat
      centerLon = loc.lng
      radiusInMeters = Math.max(100, Math.floor((radius || 15) * 1000))

      const latOffset = (radius || 15) / 111
      const lonOffset = (radius || 15) / (111 * Math.cos((centerLat * Math.PI) / 180))
      minLat = centerLat - latOffset
      maxLat = centerLat + latOffset
      minLon = centerLon - lonOffset
      maxLon = centerLon + lonOffset
    }

    const isAllCategories = !category || category.toLowerCase().trim() === 'all-categories' || category.toLowerCase().trim() === 'all categories'
    
    // Fetch places
    let allPlaces: any[] = []
    const maxResults = typeof limit === 'number' && limit > 0 ? limit : 60

    if (isAllCategories) {
      // Use Nearby Search (New) optimized for finding any type of business near center coordinate
      console.log(`Fetching Nearby Search (New) results...`)
      const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
          'X-Goog-FieldMask': PLACE_FIELDS
        },
        body: JSON.stringify({
          maxResultCount: Math.min(20, maxResults),
          locationRestriction: {
            circle: {
              center: { latitude: centerLat, longitude: centerLon },
              radius: radiusInMeters
            }
          }
        })
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`Google Places Nearby Search failed: ${response.status} - ${errText}`)
      }

      const data = await response.json()
      if (data.places) {
        allPlaces = data.places
      }
    } else {
      // Use Text Search (New) for keyword specific searches
      const queryText = category
      let pageToken: string | null = null
      let pagesFetched = 0

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
            'X-Goog-FieldMask': `${PLACE_FIELDS},nextPageToken`
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

        if (pageToken && allPlaces.length < maxResults && pagesFetched < 3) {
          await new Promise(resolve => setTimeout(resolve, 500))
        } else {
          pageToken = null
        }
      } while (pageToken)
    }

    // Map new Place objects directly to the DB schema
    const results = allPlaces.slice(0, maxResults).map((place) => {
      const name = place.displayName?.text || 'Unknown Business'
      const { website, socials } = classifyWebsite(place.websiteUri)
      return {
        id: place.id,
        name,
        address: place.formattedAddress || 'No Address Provided',
        phone: place.internationalPhoneNumber || 'N/A',
        website,
        socials,
        googleMapsUri: place.googleMapsUri ||
          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${place.id}`,
        rating: place.rating ?? undefined,
        userRatingCount: place.userRatingCount ?? undefined,
        openingHours: place.regularOpeningHours?.weekdayDescriptions?.join('\n') || undefined,
        businessStatus: place.businessStatus || undefined,
        category: place.types && place.types.length > 0 ? place.types[0].replace(/_/g, ' ') : category,
        lat: place.location?.latitude ?? centerLat,
        lon: place.location?.longitude ?? centerLon,
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
              socials: Object.keys(r.socials).length > 0 ? r.socials : null,
              google_maps_uri: r.googleMapsUri ?? null,
              rating: r.rating ?? null,
              user_rating_count: r.userRatingCount ?? null,
              opening_hours: r.openingHours ?? null,
              business_status: r.businessStatus ?? null,
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
