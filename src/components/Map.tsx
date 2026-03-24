import { useEffect } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useScraping } from '../context/ScrapingContext';
import L from 'leaflet';

// Fix Leaflet's default icon path issues in React
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

function MapUpdater({ location, mapCenter, setMapCenter }: { location: string, mapCenter: [number, number] | null, setMapCenter: (center: [number, number] | null) => void }) {
  const map = useMap();

  useEffect(() => {
    if (!location) return;

    // We assume if mapCenter is set, and it matches the location (geocoded), we shouldn't re-geocode.
    // However, if the user typed something new, mapCenter will be out of sync.
    // So we geocode the string location.

    const geocode = async () => {
      try {
        const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(location)}&limit=1`);
        const data = await res.json();
        if (data && data.features && data.features.length > 0) {
          const [lon, lat] = data.features[0].geometry.coordinates;

          // Avoid flying to the coordinates if the mapCenter is already very close to the geocoded result
          // This prevents map jumping when a user clicks a map (updating location field via reverse geocode)
          // and then the location field triggers a forward geocode.
          // We must update the mapCenter to ensure the backend scrape uses this geocoded location,
          // rather than an old pin the user might have clicked previously.
          // However, we only update setMapCenter if the new location is significantly different
          // to avoid an infinite loop where setMapCenter causes a re-render which triggers geocode again.
          // Check distance to see if we should jump and set a new pin
          if (mapCenter) {
              const distance = map.distance(mapCenter, [lat, lon]);
              if (distance < 2000) {
                  return; // already very close, do nothing
              }
          }

          // The user typed a new location that is far away.
          // Move the map, and update the pin (mapCenter) to match the geocoded location.
          const newCenter: [number, number] = [parseFloat(lat), parseFloat(lon)];
          map.setView(newCenter, 13, {
            animate: true,
          });
          setMapCenter(newCenter);
        }
      } catch (err) {
        console.error('Failed to geocode location for map:', err);
      }
    };

    const timeoutId = setTimeout(geocode, 1000); // Debounce geocoding
    return () => clearTimeout(timeoutId);
  }, [location, map, mapCenter, setMapCenter]);

  return null;
}

function MapClickHandler() {
  const { setLocation, setMapCenter } = useScraping();
  const map = useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      setMapCenter([lat, lng]);

      // Reverse geocode to get a readable location string
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
        .then(res => res.json())
        .then(data => {
            if (data && data.address) {
                // Try to build a readable city/area name
                const area = data.address.city || data.address.town || data.address.village || data.address.suburb || data.address.county || "";
                const state = data.address.state || "";
                if (area) {
                    setLocation(`${area}${state ? `, ${state}` : ''}`);
                } else if (data.display_name) {
                    // Fallback to a shortened display name
                    const parts = data.display_name.split(',');
                    setLocation(parts.slice(0, 3).join(',').trim());
                } else {
                    setLocation(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
                }
            } else {
                setLocation(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
            }
        })
        .catch(err => {
            console.error("Reverse geocoding failed", err);
            setLocation(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        });

      map.flyTo(e.latlng, map.getZoom());
    },
  });
  return null;
}

export default function Map() {
  const { location, mapCenter, setMapCenter } = useScraping();

  // Default to a central location (e.g. New York or center of US)
  const defaultCenter: [number, number] = [39.8283, -98.5795];

  return (
    <MapContainer
      center={defaultCenter}
      zoom={4}
      scrollWheelZoom={true}
      style={{ width: '100%', height: '100%', zIndex: 10 }}
      zoomControl={false} // We will use custom zoom controls if we want, or rely on Leaflet's default somewhere else, but setting to false avoids overlap with the UI if needed
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {mapCenter && <Marker position={mapCenter} />}
      <MapUpdater location={location} mapCenter={mapCenter} setMapCenter={setMapCenter} />
      <MapClickHandler />
    </MapContainer>
  );
}
