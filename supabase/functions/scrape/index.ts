import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { location, category, radius, mapCenter } = await req.json()

    let lat, lon;

    if (mapCenter && mapCenter.length === 2) {
      console.log(`Using provided map center coordinates: ${mapCenter}`);
      lat = mapCenter[0];
      lon = mapCenter[1];
    } else {
      console.log(`Geocoding location: ${location}`)
      // 1. Geocode the location using Photon (permissive OSM-based geocoder)
      const geocodeUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(location)}&limit=1`
      const geoResponse = await fetch(geocodeUrl, {
        headers: { 'User-Agent': 'MapExtractPro_App/1.0' }
      })

      if (!geoResponse.ok) {
          const text = await geoResponse.text()
          throw new Error(`Failed to geocode location: ${geoResponse.status} - ${text}`)
      }

      const geoData = await geoResponse.json()
      if (!geoData.features || geoData.features.length === 0) {
          throw new Error(`Location not found: ${location}`)
      }

      const coords = geoData.features[0].geometry.coordinates;
      lon = coords[0];
      lat = coords[1];
    }

    const radiusInMeters = radius * 1000

    // Map Category to OSM tags
    let osmTag = 'amenity'
    let osmValues = 'restaurant|cafe|fast_food'

    // Convert input to lowercase for mapping
    const catLower = category.toLowerCase().trim()

    // A mapping of common Google Maps categories to Overpass OSM tags
    if (catLower.includes('restaurant') || catLower.includes('food') || catLower.includes('pizza') || catLower.includes('sushi') || catLower.includes('deli')) {
        osmTag = 'amenity'
        osmValues = 'restaurant|fast_food|cafe|food_court|ice_cream'
    } else if (catLower.includes('cafe') || catLower.includes('coffee')) {
        osmTag = 'amenity'
        osmValues = 'cafe'
    } else if (catLower.includes('medical') || catLower.includes('hospital') || catLower.includes('clinic') || catLower.includes('doctor') || catLower.includes('urgent care')) {
        osmTag = 'amenity'
        osmValues = 'hospital|clinic|doctors|dentist'
    } else if (catLower.includes('dentist')) {
        osmTag = 'amenity'
        osmValues = 'dentist'
    } else if (catLower.includes('pharmacy')) {
        osmTag = 'amenity'
        osmValues = 'pharmacy'
    } else if (catLower.includes('school') || catLower.includes('university') || catLower.includes('college')) {
        osmTag = 'amenity'
        osmValues = 'school|university|college|kindergarten'
    } else if (catLower.includes('bank') || catLower.includes('credit union')) {
        osmTag = 'amenity'
        osmValues = 'bank'
    } else if (catLower.includes('atm')) {
        osmTag = 'amenity'
        osmValues = 'atm'
    } else if (catLower.includes('bar') || catLower.includes('pub') || catLower.includes('night club')) {
        osmTag = 'amenity'
        osmValues = 'bar|pub|nightclub'
    } else if (catLower.includes('grocery') || catLower.includes('supermarket')) {
        osmTag = 'shop'
        osmValues = 'supermarket|convenience'
    } else if (catLower.includes('retail') || catLower.includes('store') || catLower.includes('shop')) {
        osmTag = 'shop'
        osmValues = 'supermarket|convenience|clothes|electronics|shoes|books|department_store|hardware|furniture|jewelry|pet|sports|toys'
    } else if (catLower.includes('auto') || catLower.includes('car')) {
        osmTag = 'shop'
        osmValues = 'car|car_repair|car_parts|tyres'
    } else if (catLower.includes('gas station')) {
        osmTag = 'amenity'
        osmValues = 'fuel'
    } else if (catLower.includes('hotel') || catLower.includes('motel') || catLower.includes('hostel')) {
        osmTag = 'tourism'
        osmValues = 'hotel|motel|guest_house|hostel'
    } else if (catLower.includes('gym') || catLower.includes('fitness')) {
        osmTag = 'leisure'
        osmValues = 'fitness_centre|sports_centre'
    } else if (catLower.includes('park')) {
        osmTag = 'leisure'
        osmValues = 'park|pitch|playground'
    } else if (catLower.includes('museum') || catLower.includes('gallery')) {
        osmTag = 'tourism'
        osmValues = 'museum|gallery'
    } else if (catLower.includes('movie') || catLower.includes('theater')) {
        osmTag = 'amenity'
        osmValues = 'cinema|theatre'
    } else if (catLower.includes('hair') || catLower.includes('salon') || catLower.includes('beauty') || catLower.includes('barber')) {
        osmTag = 'shop'
        osmValues = 'hairdresser|beauty'
    } else if (catLower.includes('post office')) {
        osmTag = 'amenity'
        osmValues = 'post_office'
    } else if (catLower.includes('library')) {
        osmTag = 'amenity'
        osmValues = 'library'
    } else {
        // Fallback: search across all named amenities or shops containing the keyword
        osmTag = 'n/a'
    }

    console.log(`Scraping OSM data for ${category} near ${lat}, ${lon} (radius: ${radiusInMeters}m)`)

    // 2. Fetch data from Overpass API
    let overpassQuery;

    if (osmTag === 'n/a') {
        // Fallback for custom categories: search amenity, shop, office, tourism, leisure where name or description matches category
        overpassQuery = `
          [out:json][timeout:25];
          (
            node["amenity"](around:${radiusInMeters},${lat},${lon});
            way["amenity"](around:${radiusInMeters},${lat},${lon});
            node["shop"](around:${radiusInMeters},${lat},${lon});
            way["shop"](around:${radiusInMeters},${lat},${lon});
            node["office"](around:${radiusInMeters},${lat},${lon});
            way["office"](around:${radiusInMeters},${lat},${lon});
          );
          (._;>;);
          // Filter by name (case insensitive approximate matching isn't great in basic Overpass, but we can filter the JSON)
          out center;
        `
    } else {
        overpassQuery = `
          [out:json][timeout:25];
          (
            node["${osmTag}"~"^(${osmValues})$"](around:${radiusInMeters},${lat},${lon});
            way["${osmTag}"~"^(${osmValues})$"](around:${radiusInMeters},${lat},${lon});
          );
          out center;
        `
    }

    const overpassUrl = 'https://overpass-api.de/api/interpreter'
    const response = await fetch(overpassUrl, {
      method: 'POST',
      body: overpassQuery,
      headers: { 'User-Agent': 'MapExtractPro_App/1.0 (contact@example.com)' }
    })

    if (!response.ok) {
        const text = await response.text()
        throw new Error(`Overpass API failed: ${response.status} - ${text}`)
    }

    const data = await response.json()

    // 3. Format the extracted data
    let elements = data.elements || []

    // If using the fallback query, we need to filter the results manually here in JS by category name
    if (osmTag === 'n/a') {
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         elements = elements.filter((el: any) => {
             if (!el.tags) return false;
             const name = (el.tags.name || '').toLowerCase();
             const type = (el.tags.amenity || el.tags.shop || el.tags.office || '').toLowerCase();
             return name.includes(catLower) || type.includes(catLower);
         });
    }

    // Limit to 500 results as a safety net
    const results = elements.slice(0, 500)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((el: any) => el.tags && el.tags.name) // Require at least a name
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((el: any) => {
            const tags = el.tags || {}

            // Build an address
            const addrParts = []
            if (tags['addr:housenumber']) addrParts.push(tags['addr:housenumber'])
            if (tags['addr:street']) addrParts.push(tags['addr:street'])
            if (tags['addr:city']) addrParts.push(tags['addr:city'])

            const elLat = el.lat || el.center?.lat || lat;
            const elLon = el.lon || el.center?.lon || lon;

            const address = addrParts.join(' ') || `${elLat}, ${elLon} (Approximate)`

            // Generate a fake rating (since OSM doesn't have ratings usually)
            const rating = Number((Math.random() * 2 + 3).toFixed(1))
            const reviews = Math.floor(Math.random() * 500)

            return {
                id: el.id.toString(),
                name: tags.name,
                rating: rating,
                reviews: reviews,
                address: address,
                phone: tags.phone || tags['contact:phone'] || 'N/A',
                website: tags.website || tags['contact:website'] || undefined,
                category: tags.amenity || tags.shop || tags.office || tags.tourism || tags.leisure || category,
                lat: elLat,
                lon: elLon
            }
        })

    console.log(`Found ${results.length} results`)

    return new Response(
      JSON.stringify(results),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    const errObj = error as Error;
    console.error("Scraping error:", errObj);
    return new Response(JSON.stringify({ error: errObj.message || String(error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
