import { useEffect } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useScraping } from '../context/ScrapingContext';

function MapUpdater({ location }: { location: string }) {
  const map = useMap();

  useEffect(() => {
    if (!location) return;

    const geocode = async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`);
        const data = await res.json();
        if (data && data.length > 0) {
          const { lat, lon } = data[0];
          map.setView([parseFloat(lat), parseFloat(lon)], 13, {
            animate: true,
          });
        }
      } catch (err) {
        console.error('Failed to geocode location for map:', err);
      }
    };

    const timeoutId = setTimeout(geocode, 1000); // Debounce geocoding
    return () => clearTimeout(timeoutId);
  }, [location, map]);

  return null;
}

export default function Map() {
  const { location } = useScraping();

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
      <MapUpdater location={location} />
    </MapContainer>
  );
}
