import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OsmMapping { tag: string; values: string }

// Ordered list: first keyword match wins. Add new categories here.
const CATEGORY_MAPPINGS: Array<{ keywords: string[]; mapping: OsmMapping }> = [
  // Food & Drink
  { keywords: ['fast food'], mapping: { tag: 'amenity', values: 'fast_food' } },
  { keywords: ['restaurant', 'pizza', 'sushi', 'deli', 'burger', 'chinese', 'italian', 'thai', 'indian', 'japanese', 'mexican restaurant', 'vegetarian', 'vegan restaurant'], mapping: { tag: 'amenity', values: 'restaurant|fast_food|food_court' } },
  { keywords: ['cafe', 'coffee shop', 'coffee'], mapping: { tag: 'amenity', values: 'cafe' } },
  { keywords: ['bar', 'pub', 'night club', 'nightclub'], mapping: { tag: 'amenity', values: 'bar|pub|nightclub' } },
  { keywords: ['ice cream', 'dessert'], mapping: { tag: 'amenity', values: 'ice_cream' } },
  { keywords: ['bakery', 'bakeries'], mapping: { tag: 'shop', values: 'bakery' } },
  { keywords: ['butcher'], mapping: { tag: 'shop', values: 'butcher' } },
  { keywords: ['grocery', 'supermarket', 'groceries'], mapping: { tag: 'shop', values: 'supermarket|convenience' } },
  { keywords: ['convenience store', 'convenience'], mapping: { tag: 'shop', values: 'convenience' } },
  { keywords: ['liquor store', 'alcohol'], mapping: { tag: 'shop', values: 'alcohol' } },
  { keywords: ['winery', 'wineries'], mapping: { tag: 'craft', values: 'winery' } },

  // Health & Medical
  { keywords: ['hospital', 'medical center', 'urgent care'], mapping: { tag: 'amenity', values: 'hospital|clinic' } },
  { keywords: ['clinic', 'doctor', 'physician'], mapping: { tag: 'amenity', values: 'clinic|doctors' } },
  { keywords: ['dentist', 'orthodontist'], mapping: { tag: 'amenity', values: 'dentist' } },
  { keywords: ['pharmacy'], mapping: { tag: 'amenity', values: 'pharmacy' } },
  { keywords: ['veterinarian', 'animal hospital', 'vet'], mapping: { tag: 'amenity', values: 'veterinary' } },
  { keywords: ['optometrist', 'optician'], mapping: { tag: 'healthcare', values: 'optometrist' } },
  { keywords: ['physical therapist', 'physiotherapist'], mapping: { tag: 'healthcare', values: 'physiotherapist' } },
  { keywords: ['psychologist', 'chiropractor', 'dermatologist', 'therapist'], mapping: { tag: 'amenity', values: 'doctors' } },

  // Automotive
  { keywords: ['auto repair', 'auto body', 'car repair', 'mechanic'], mapping: { tag: 'shop', values: 'car_repair' } },
  { keywords: ['auto dealer', 'car dealer', 'used car'], mapping: { tag: 'shop', values: 'car' } },
  { keywords: ['auto parts', 'car parts'], mapping: { tag: 'shop', values: 'car_parts' } },
  { keywords: ['gas station', 'fuel'], mapping: { tag: 'amenity', values: 'fuel' } },
  { keywords: ['car wash'], mapping: { tag: 'amenity', values: 'car_wash' } },
  { keywords: ['car rental'], mapping: { tag: 'amenity', values: 'car_rental' } },
  { keywords: ['tire', 'tyre'], mapping: { tag: 'shop', values: 'tyres' } },
  { keywords: ['towing'], mapping: { tag: 'amenity', values: 'vehicle_inspection' } },

  // Professional Services
  { keywords: ['accountant', 'accounting', 'tax preparation'], mapping: { tag: 'office', values: 'accountant' } },
  { keywords: ['lawyer', 'attorney', 'law firm'], mapping: { tag: 'office', values: 'lawyer' } },
  { keywords: ['insurance'], mapping: { tag: 'office', values: 'insurance' } },
  { keywords: ['real estate', 'property management', 'apartment'], mapping: { tag: 'office', values: 'estate_agent' } },
  { keywords: ['advertising', 'marketing', 'web design'], mapping: { tag: 'office', values: 'it|advertising_agency' } },
  { keywords: ['financial planner', 'investment', 'mortgage'], mapping: { tag: 'office', values: 'financial' } },
  { keywords: ['engineer', 'architect'], mapping: { tag: 'office', values: 'architect|engineer' } },
  { keywords: ['employment agency', 'staffing'], mapping: { tag: 'office', values: 'employment_agency' } },
  { keywords: ['travel agenc'], mapping: { tag: 'shop', values: 'travel_agency' } },
  { keywords: ['print', 'sign shop'], mapping: { tag: 'shop', values: 'copyshop|signs' } },
  { keywords: ['interior designer', 'interior design'], mapping: { tag: 'office', values: 'interior_design' } },
  { keywords: ['event planner', 'wedding planning', 'caterer'], mapping: { tag: 'office', values: 'event_venue' } },
  { keywords: ['internet service', 'isp'], mapping: { tag: 'office', values: 'telecommunication' } },

  // Beauty & Personal Care
  { keywords: ['hair salon', 'hairdresser', 'barber'], mapping: { tag: 'shop', values: 'hairdresser|barber' } },
  { keywords: ['beauty salon', 'nail salon', 'cosmetics'], mapping: { tag: 'shop', values: 'beauty|cosmetics' } },
  { keywords: ['day spa', 'spa', 'massage'], mapping: { tag: 'leisure', values: 'spa' } },
  { keywords: ['tattoo'], mapping: { tag: 'shop', values: 'tattoo' } },
  { keywords: ['tailor', 'alteration'], mapping: { tag: 'shop', values: 'tailor' } },
  { keywords: ['dry clean', 'laundromat', 'laundry'], mapping: { tag: 'shop', values: 'dry_cleaning|laundry' } },

  // Retail
  { keywords: ['clothing', "women's clothing", 'fashion'], mapping: { tag: 'shop', values: 'clothes' } },
  { keywords: ['shoe store', 'shoes'], mapping: { tag: 'shop', values: 'shoes' } },
  { keywords: ['electronics', 'computer repair'], mapping: { tag: 'shop', values: 'electronics|computer' } },
  { keywords: ['furniture'], mapping: { tag: 'shop', values: 'furniture' } },
  { keywords: ['hardware store', 'lumber'], mapping: { tag: 'shop', values: 'hardware|doityourself' } },
  { keywords: ['jewelry', 'jewellery'], mapping: { tag: 'shop', values: 'jewelry' } },
  { keywords: ['book', 'bookstore'], mapping: { tag: 'shop', values: 'books' } },
  { keywords: ['pet store', 'pet shop'], mapping: { tag: 'shop', values: 'pet' } },
  { keywords: ['gift shop', 'gift'], mapping: { tag: 'shop', values: 'gift' } },
  { keywords: ['sporting goods', 'bicycle', 'bikes'], mapping: { tag: 'shop', values: 'sports|bicycle' } },
  { keywords: ['antique'], mapping: { tag: 'shop', values: 'antiques' } },
  { keywords: ['vitamin', 'health food', 'supplement'], mapping: { tag: 'shop', values: 'health_food' } },
  { keywords: ['florist', 'flower'], mapping: { tag: 'shop', values: 'florist' } },
  { keywords: ['shopping center', 'mall', 'department store'], mapping: { tag: 'shop', values: 'mall|department_store' } },
  { keywords: ['video game'], mapping: { tag: 'shop', values: 'video_games' } },
  { keywords: ['photographer', 'photo'], mapping: { tag: 'shop', values: 'photo' } },
  { keywords: ['wholesale', 'wholesaler', 'warehouse'], mapping: { tag: 'shop', values: 'wholesale' } },
  { keywords: ['nursery', 'garden center'], mapping: { tag: 'shop', values: 'garden_centre' } },

  // Trades & Contractors
  { keywords: ['electrician', 'electrical'], mapping: { tag: 'craft', values: 'electrician' } },
  { keywords: ['plumber', 'plumbing'], mapping: { tag: 'craft', values: 'plumber' } },
  { keywords: ['roofer', 'roofing'], mapping: { tag: 'craft', values: 'roofer' } },
  { keywords: ['painter', 'painting contractor'], mapping: { tag: 'craft', values: 'painter' } },
  { keywords: ['carpenter', 'carpentry'], mapping: { tag: 'craft', values: 'carpenter' } },
  { keywords: ['locksmith'], mapping: { tag: 'craft', values: 'locksmith' } },
  { keywords: ['pest control', 'exterminator'], mapping: { tag: 'craft', values: 'pest_control' } },
  { keywords: ['landscaping', 'lawn'], mapping: { tag: 'craft', values: 'landscaping' } },
  { keywords: ['tree service', 'arborist'], mapping: { tag: 'craft', values: 'tree_surgeon' } },
  { keywords: ['air condition', 'hvac', 'heating contractor'], mapping: { tag: 'shop', values: 'hvac' } },
  { keywords: ['contractor', 'construction'], mapping: { tag: 'office', values: 'construction_company' } },
  { keywords: ['moving company', 'mover'], mapping: { tag: 'shop', values: 'moving_and_storage' } },
  { keywords: ['storage'], mapping: { tag: 'amenity', values: 'storage_rental' } },
  { keywords: ['carpet cleaning'], mapping: { tag: 'craft', values: 'cleaning' } },

  // Education
  { keywords: ['university', 'college'], mapping: { tag: 'amenity', values: 'university|college' } },
  { keywords: ['school', 'elementary'], mapping: { tag: 'amenity', values: 'school' } },
  { keywords: ['child care', 'daycare', 'preschool'], mapping: { tag: 'amenity', values: 'childcare|kindergarten' } },
  { keywords: ['library'], mapping: { tag: 'amenity', values: 'library' } },

  // Financial
  { keywords: ['bank', 'credit union'], mapping: { tag: 'amenity', values: 'bank' } },
  { keywords: ['atm'], mapping: { tag: 'amenity', values: 'atm' } },

  // Hospitality & Tourism
  { keywords: ['hotel', 'motel', 'hostel', 'inn'], mapping: { tag: 'tourism', values: 'hotel|motel|guest_house|hostel' } },
  { keywords: ['campground', 'camping'], mapping: { tag: 'tourism', values: 'camp_site' } },
  { keywords: ['museum'], mapping: { tag: 'tourism', values: 'museum' } },
  { keywords: ['art gallery', 'gallery'], mapping: { tag: 'tourism', values: 'gallery' } },
  { keywords: ['amusement park', 'theme park'], mapping: { tag: 'tourism', values: 'theme_park|attraction' } },

  // Recreation & Fitness
  { keywords: ['gym', 'fitness center', 'fitness', 'yoga'], mapping: { tag: 'leisure', values: 'fitness_centre|sports_centre' } },
  { keywords: ['golf course', 'golf'], mapping: { tag: 'leisure', values: 'golf_course' } },
  { keywords: ['bowling alley', 'bowling'], mapping: { tag: 'leisure', values: 'bowling_alley' } },
  { keywords: ['park', 'playground'], mapping: { tag: 'leisure', values: 'park|pitch|playground' } },

  // Entertainment
  { keywords: ['movie theater', 'cinema', 'theatre'], mapping: { tag: 'amenity', values: 'cinema|theatre' } },

  // Public Services
  { keywords: ['taxi', 'cab'], mapping: { tag: 'amenity', values: 'taxi' } },
  { keywords: ['bus', 'transit'], mapping: { tag: 'amenity', values: 'bus_station' } },
  { keywords: ['airport', 'airline'], mapping: { tag: 'aeroway', values: 'aerodrome' } },
  { keywords: ['post office', 'postal'], mapping: { tag: 'amenity', values: 'post_office' } },
  { keywords: ['fire station'], mapping: { tag: 'amenity', values: 'fire_station' } },
  { keywords: ['police station', 'security', 'police'], mapping: { tag: 'amenity', values: 'police' } },
  { keywords: ['funeral home', 'cemetery'], mapping: { tag: 'amenity', values: 'funeral_hall' } },
  { keywords: ['church', 'mosque', 'synagogue', 'temple', 'place of worship'], mapping: { tag: 'amenity', values: 'place_of_worship' } },
  { keywords: ['dog walker', 'dog grooming', 'pet service'], mapping: { tag: 'shop', values: 'pet_grooming|pet' } },
]

function resolveOsmMapping(catLower: string): OsmMapping | null {
  for (const { keywords, mapping } of CATEGORY_MAPPINGS) {
    if (keywords.some(kw => catLower.includes(kw))) return mapping
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { location, category, radius, limit, mapCenter, requiredFields, bbox } = await req.json()

    let lat: number, lon: number

    if (bbox && bbox.length === 4) {
      lat = (bbox[0] + bbox[2]) / 2
      lon = (bbox[1] + bbox[3]) / 2
    } else if (mapCenter && mapCenter.length === 2) {
      lat = mapCenter[0]
      lon = mapCenter[1]
    } else {
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
      const coords = geoData.features[0].geometry.coordinates
      lon = coords[0]
      lat = coords[1]
    }

    const radiusInMeters = Math.floor(radius * 1000)
    const catLower = (category as string).toLowerCase().trim()
    const mapping = resolveOsmMapping(catLower)

    let overpassQuery: string
    if (bbox && bbox.length === 4) {
      const [minLat, minLon, maxLat, maxLon] = bbox
      if (mapping) {
        overpassQuery = `
          [out:json][timeout:25];
          (
            node["${mapping.tag}"~"^(${mapping.values})$"](${minLat},${minLon},${maxLat},${maxLon});
            way["${mapping.tag}"~"^(${mapping.values})$"](${minLat},${minLon},${maxLat},${maxLon});
          );
          out center;
        `
      } else {
        overpassQuery = `
          [out:json][timeout:25];
          (
            node["amenity"](${minLat},${minLon},${maxLat},${maxLon});
            way["amenity"](${minLat},${minLon},${maxLat},${maxLon});
            node["shop"](${minLat},${minLon},${maxLat},${maxLon});
            way["shop"](${minLat},${minLon},${maxLat},${maxLon});
            node["office"](${minLat},${minLon},${maxLat},${maxLon});
            way["office"](${minLat},${minLon},${maxLat},${maxLon});
          );
          out center;
        `
      }
    } else {
      if (mapping) {
        overpassQuery = `
          [out:json][timeout:25];
          (
            node["${mapping.tag}"~"^(${mapping.values})$"](around:${radiusInMeters},${lat},${lon});
            way["${mapping.tag}"~"^(${mapping.values})$"](around:${radiusInMeters},${lat},${lon});
          );
          out center;
        `
      } else {
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
          out center;
        `
      }
    }

    const overpassUrls = [
      'https://overpass-api.de/api/interpreter',
      'https://lz4.overpass-api.de/api/interpreter',
      'https://z.overpass-api.de/api/interpreter',
      'https://overpass.private.coffee/api/interpreter'
    ]

    let lastError: Error | null = null
    let response: Response | null = null
    const attemptLogs: string[] = []

    for (const overpassUrl of overpassUrls) {
      console.log(`Trying Overpass URL: ${overpassUrl}`)
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 20000) // 20-second timeout per mirror
        
        const res = await fetch(overpassUrl, {
          method: 'POST',
          body: 'data=' + encodeURIComponent(overpassQuery),
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Origin': 'https://overpass-turbo.eu',
            'Referer': 'https://overpass-turbo.eu/'
          },
          signal: controller.signal
        })
        clearTimeout(timeoutId)
        
        if (res.ok) {
          response = res
          console.log(`Successfully fetched from ${overpassUrl}`)
          break
        } else {
          const text = await res.text()
          const logMsg = `Overpass URL ${overpassUrl} failed with status ${res.status}: ${text.substring(0, 100)}`
          console.warn(logMsg)
          attemptLogs.push(logMsg)
          lastError = new Error(`Overpass API ${overpassUrl} failed: ${res.status} - ${text}`)
        }
      } catch (err) {
        const logMsg = `Failed to connect to ${overpassUrl}: ${(err as Error).message}`
        console.warn(logMsg)
        attemptLogs.push(logMsg)
        lastError = err as Error
      }
    }

    if (!response) {
      throw new Error(`All Overpass API mirrors failed.\nDetails:\n${attemptLogs.join('\n')}`)
    }

    const data = await response.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let elements: any[] = data.elements || []

    if (!mapping && catLower !== 'all categories') {
      elements = elements.filter((el: { tags?: Record<string, string> }) => {
        if (!el.tags) return false
        const name = (el.tags.name || '').toLowerCase()
        const type = (el.tags.amenity || el.tags.shop || el.tags.office || '').toLowerCase()
        return name.includes(catLower) || type.includes(catLower)
      })
    }

    const maxResults = typeof limit === 'number' && limit > 0 ? limit : 500

    // Filter and map elements to structured results
    const rawResults = elements
      .filter((el: { tags?: Record<string, string> }) => el.tags?.name)
      .map((el: { id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags: Record<string, string> }) => {
        const tags = el.tags
        const addrParts: string[] = []
        if (tags['addr:housenumber']) addrParts.push(tags['addr:housenumber'])
        if (tags['addr:street']) addrParts.push(tags['addr:street'])
        if (tags['addr:city']) addrParts.push(tags['addr:city'])
        const elLat = el.lat ?? el.center?.lat ?? lat
        const elLon = el.lon ?? el.center?.lon ?? lon
        const streetAddress = addrParts.join(' ')
        const rawPhone = tags.phone || tags['contact:phone'] || ''
        const rawWebsite = tags.website || tags['contact:website'] || ''
        return {
          id: el.id.toString(),
          name: tags.name,
          address: streetAddress || `${elLat.toFixed(5)}, ${elLon.toFixed(5)}`,
          phone: rawPhone || 'N/A',
          website: rawWebsite || undefined,
          category: tags.amenity || tags.shop || tags.office || tags.tourism || tags.leisure || category,
          lat: elLat,
          lon: elLon,
          hasRealAddress: streetAddress.length > 0,
          hasPhone: rawPhone.length > 0,
          hasWebsite: rawWebsite.length > 0,
        }
      })
      .filter((r) => {
        if (!requiredFields || !Array.isArray(requiredFields)) return true
        if (requiredFields.includes('name') && !r.name) return false
        if (requiredFields.includes('phone') && !r.hasPhone) return false
        if (requiredFields.includes('address') && !r.hasRealAddress) return false
        if (requiredFields.includes('website') && !r.hasWebsite) return false
        return true
      })

    // Deduplicate results by name and distance (50m radius)
    const deduplicated: typeof rawResults = []
    const seen: Array<{ name: string; lat: number; lon: number }> = []

    for (const r of rawResults) {
      const nameNorm = r.name.toLowerCase().trim()
      let isDuplicate = false
      for (const item of seen) {
        if (item.name === nameNorm) {
          const dLat = (r.lat - item.lat) * 111000
          const dLon = (r.lon - item.lon) * 111000 * Math.cos((r.lat * Math.PI) / 180)
          const dist = Math.sqrt(dLat * dLat + dLon * dLon)
          if (dist < 50) {
            isDuplicate = true
            break
          }
        }
      }
      if (!isDuplicate) {
        seen.push({ name: nameNorm, lat: r.lat, lon: r.lon })
        deduplicated.push(r)
      }
    }

    const results = deduplicated.slice(0, maxResults)

    // Save to DB (best-effort — don't fail the request if this errors)
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
            results.map((r: { id: string; name: string; category: string; address: string; phone: string; website?: string; lat: number; lon: number }) => ({
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

    console.log(`Found ${results.length} results`)

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
