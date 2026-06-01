import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents, Marker, Circle, Popup, Rectangle } from 'react-leaflet';
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

    // If mapCenter is already set (e.g., user clicked the map), we skip geocoding
    // the location string to prevent the pin from jumping back to a general city center.
    // Dashboard.tsx explicitly clears mapCenter when the user types a new location.
    if (mapCenter) return;

    const geocode = async () => {
      try {
        const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(location)}&limit=1`);
        const data = await res.json();
        if (data && data.features && data.features.length > 0) {
          const [lon, lat] = data.features[0].geometry.coordinates;

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
  const { setLocation, setMapCenter, selectionMode } = useScraping();
  const map = useMapEvents({
    click(e) {
      if (selectionMode) return;
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

function MapSelectionHandler() {
  const { selectionMode, selectedBbox, setSelectedBbox, setLocation } = useScraping();
  const map = useMap();
  const [startPoint, setStartPoint] = useState<L.LatLng | null>(null);
  const [currentPoint, setCurrentPoint] = useState<L.LatLng | null>(null);

  useEffect(() => {
    if (selectionMode) {
      map.dragging.disable();
    } else {
      map.dragging.enable();
      setStartPoint(null);
      setCurrentPoint(null);
    }
  }, [selectionMode, map]);

  useMapEvents({
    mousedown(e) {
      if (!selectionMode) return;
      setStartPoint(e.latlng);
      setCurrentPoint(e.latlng);
    },
    mousemove(e) {
      if (!selectionMode || !startPoint) return;
      setCurrentPoint(e.latlng);
    },
    mouseup(e) {
      if (!selectionMode || !startPoint) return;
      const endLatLng = e.latlng;
      
      const minLat = Math.min(startPoint.lat, endLatLng.lat);
      const maxLat = Math.max(startPoint.lat, endLatLng.lat);
      const minLon = Math.min(startPoint.lng, endLatLng.lng);
      const maxLon = Math.max(startPoint.lng, endLatLng.lng);

      setSelectedBbox([minLat, minLon, maxLat, maxLon]);
      setLocation(`Selection: [${minLat.toFixed(3)}, ${minLon.toFixed(3)} - ${maxLat.toFixed(3)}, ${maxLon.toFixed(3)}]`);

      setStartPoint(null);
      setCurrentPoint(null);
    }
  });

  if (!selectionMode) {
    if (selectedBbox) {
      const [minLat, minLon, maxLat, maxLon] = selectedBbox;
      return (
        <Rectangle
          bounds={[[minLat, minLon], [maxLat, maxLon]]}
          pathOptions={{
            color: '#ef4444',
            fillColor: '#ef4444',
            fillOpacity: 0.15,
            weight: 2,
          }}
        />
      );
    }
    return null;
  }

  if (startPoint && currentPoint) {
    const minLat = Math.min(startPoint.lat, currentPoint.lat);
    const maxLat = Math.max(startPoint.lat, currentPoint.lat);
    const minLon = Math.min(startPoint.lng, currentPoint.lng);
    const maxLon = Math.max(startPoint.lng, currentPoint.lng);

    return (
      <Rectangle
        bounds={[[minLat, minLon], [maxLat, maxLon]]}
        pathOptions={{
          color: '#ef4444',
          fillColor: '#ef4444',
          fillOpacity: 0.2,
          weight: 2,
          dashArray: '4 4'
        }}
      />
    );
  }

  if (selectedBbox) {
    const [minLat, minLon, maxLat, maxLon] = selectedBbox;
    return (
      <Rectangle
        bounds={[[minLat, minLon], [maxLat, maxLon]]}
        pathOptions={{
          color: '#ef4444',
          fillColor: '#ef4444',
          fillOpacity: 0.15,
          weight: 2,
        }}
      />
    );
  }

  return null;
}

export default function Map() {
  const { location, mapCenter, setMapCenter, radius, results, selectionMode, selectedBbox } = useScraping();

  // Default to Cairo, Egypt
  const defaultCenter: [number, number] = [30.0444, 31.2357];

  return (
    <MapContainer
      center={defaultCenter}
      zoom={6}
      scrollWheelZoom={true}
      style={{ width: '100%', height: '100%', zIndex: 10 }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {!selectionMode && mapCenter && <Marker position={mapCenter} />}
      {!selectionMode && !selectedBbox && mapCenter && (
        <Circle
          center={mapCenter}
          radius={radius * 1000}
          pathOptions={{
            color: '#2563eb',
            fillColor: '#3b82f6',
            fillOpacity: 0.1,
            weight: 2,
            dashArray: '5, 5',
          }}
        />
      )}
      {results.map((r) => (
        <Marker key={r.id} position={[r.lat, r.lon]}>
          <Popup>
            <div className="p-1 min-w-[150px]">
              <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">{r.name}</h4>
              <p className="text-xs text-slate-500 font-medium">{r.category}</p>
              <p className="text-xs text-slate-600 mt-1">{r.address}</p>
              {r.phone && r.phone !== 'N/A' && (
                <p className="text-xs font-mono text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1">
                  <span>📞</span> {r.phone}
                </p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
      <MapUpdater location={location} mapCenter={mapCenter} setMapCenter={setMapCenter} />
      <MapClickHandler />
      <MapSelectionHandler />
    </MapContainer>
  );
}
