import { useEffect, useRef, useState } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { useScraping } from '../context/ScrapingContext';

setOptions({
  key: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyCFbleJw-jWugYH5fJV5Q6EfICKnLCAgEI',
  v: 'weekly',
});

export default function Map() {
  const {
    location,
    setLocation,
    mapCenter,
    setMapCenter,
    radius,
    results,
    selectionMode,
    selectedBbox,
    setSelectedBbox
  } = useScraping();

  const mapRef = useRef<HTMLDivElement>(null);
  const [googleLoaded, setGoogleLoaded] = useState(false);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);

  // Refs for overlays to manage their lifecycle
  const centerMarkerRef = useRef<google.maps.Marker | null>(null);
  const radiusCircleRef = useRef<google.maps.Circle | null>(null);
  const resultsMarkersRef = useRef<google.maps.Marker[]>([]);
  const selectionRectangleRef = useRef<google.maps.Rectangle | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  // Drag selection tracking refs
  const isDrawingRef = useRef(false);
  const startLatLngRef = useRef<google.maps.LatLng | null>(null);

  // Load Google Maps libraries
  useEffect(() => {
    Promise.all([
      importLibrary('maps'),
      importLibrary('marker'),
    ])
      .then(() => {
        setGoogleLoaded(true);
      })
      .catch((err) => {
        console.error('Error loading Google Maps libraries:', err);
      });
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!googleLoaded || !mapRef.current) return;

    const defaultCenter = { lat: 30.0444, lng: 31.2357 }; // Cairo
    const initialCenter = mapCenter ? { lat: mapCenter[0], lng: mapCenter[1] } : defaultCenter;

    const map = new google.maps.Map(mapRef.current!, {
      center: initialCenter,
      zoom: mapCenter ? 13 : 6,
      disableDefaultUI: true,
      zoomControl: false,
    });

    setMapInstance(map);
  }, [googleLoaded]);

  // Sync selectionMode options (disable dragging/gestures when drawing)
  useEffect(() => {
    if (!mapInstance) return;

    if (selectionMode) {
      mapInstance.setOptions({
        draggable: false,
        gestureHandling: 'none',
      });
    } else {
      mapInstance.setOptions({
        draggable: true,
        gestureHandling: 'cooperative',
      });
    }
  }, [mapInstance, selectionMode]);

  // Forward Geocode typed location
  useEffect(() => {
    if (!location || !mapInstance) return;
    // Skip geocoding if the center was already manually set (e.g. click/drag)
    if (mapCenter) return;

    const geocode = async () => {
      try {
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyCFbleJw-jWugYH5fJV5Q6EfICKnLCAgEI';
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${apiKey}`
        );
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          const loc = data.results[0].geometry.location;
          const newCenter: [number, number] = [loc.lat, loc.lng];
          mapInstance.setCenter(loc);
          mapInstance.setZoom(13);
          setMapCenter(newCenter);
        }
      } catch (err) {
        console.error('Failed to geocode location for map:', err);
      }
    };

    const timeoutId = setTimeout(geocode, 1000); // Debounce
    return () => clearTimeout(timeoutId);
  }, [location, mapInstance, mapCenter, setMapCenter]);

  // Handle map interaction (click to pin / reverse geocode AND custom draw area)
  useEffect(() => {
    if (!mapInstance) return;

    // 1. Regular click (only active when NOT in selectionMode)
    const clickListener = mapInstance.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (selectionMode || !e.latLng) return;

      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setMapCenter([lat, lng]);

      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyCFbleJw-jWugYH5fJV5Q6EfICKnLCAgEI';
      fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`)
        .then(res => res.json())
        .then(data => {
          if (data.results && data.results.length > 0) {
            const formatted = data.results[0].formatted_address;
            const parts = formatted.split(',');
            setLocation(parts.slice(0, 3).join(',').trim());
          } else {
            setLocation(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          }
        })
        .catch(err => {
          console.error('Reverse geocoding failed:', err);
          setLocation(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        });

      mapInstance.panTo(e.latLng);
    });

    // 2. Custom area selection (mousedown/mousemove/mouseup)
    const mousedownListener = mapInstance.addListener('mousedown', (e: google.maps.MapMouseEvent) => {
      if (!selectionMode || !e.latLng) return;

      isDrawingRef.current = true;
      startLatLngRef.current = e.latLng;

      if (selectionRectangleRef.current) {
        selectionRectangleRef.current.setMap(null);
      }

      selectionRectangleRef.current = new google.maps.Rectangle({
        map: mapInstance,
        strokeColor: '#ef4444',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#ef4444',
        fillOpacity: 0.2,
        bounds: new google.maps.LatLngBounds(e.latLng, e.latLng),
      });
    });

    const mousemoveListener = mapInstance.addListener('mousemove', (e: google.maps.MapMouseEvent) => {
      if (!isDrawingRef.current || !selectionRectangleRef.current || !startLatLngRef.current || !e.latLng) return;

      const bounds = new google.maps.LatLngBounds();
      bounds.extend(startLatLngRef.current);
      bounds.extend(e.latLng);
      selectionRectangleRef.current.setBounds(bounds);
    });

    const mouseupListener = mapInstance.addListener('mouseup', (e: google.maps.MapMouseEvent) => {
      if (!isDrawingRef.current || !selectionRectangleRef.current || !startLatLngRef.current || !e.latLng) return;

      isDrawingRef.current = false;
      const bounds = selectionRectangleRef.current.getBounds();
      if (bounds) {
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const minLat = sw.lat();
        const minLon = sw.lng();
        const maxLat = ne.lat();
        const maxLon = ne.lng();
        
        setSelectedBbox([minLat, minLon, maxLat, maxLon]);
        setLocation(`Selection: [${minLat.toFixed(3)}, ${minLon.toFixed(3)} - ${maxLat.toFixed(3)}, ${maxLon.toFixed(3)}]`);
      }
    });

    return () => {
      google.maps.event.removeListener(clickListener);
      google.maps.event.removeListener(mousedownListener);
      google.maps.event.removeListener(mousemoveListener);
      google.maps.event.removeListener(mouseupListener);
    };
  }, [mapInstance, selectionMode, setLocation, setMapCenter, setSelectedBbox]);

  // Sync Center Marker and Radius Circle
  useEffect(() => {
    if (!mapInstance) return;

    if (centerMarkerRef.current) {
      centerMarkerRef.current.setMap(null);
      centerMarkerRef.current = null;
    }
    if (radiusCircleRef.current) {
      radiusCircleRef.current.setMap(null);
      radiusCircleRef.current = null;
    }

    if (!selectedBbox && mapCenter) {
      const centerLatLng = { lat: mapCenter[0], lng: mapCenter[1] };

      centerMarkerRef.current = new google.maps.Marker({
        map: mapInstance,
        position: centerLatLng,
      });

      radiusCircleRef.current = new google.maps.Circle({
        map: mapInstance,
        center: centerLatLng,
        radius: radius * 1000,
        strokeColor: '#2563eb',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#3b82f6',
        fillOpacity: 0.10,
      });
    }
  }, [mapInstance, mapCenter, radius, selectedBbox]);

  // Sync Selection Rectangle Overlay (when drawing completes or bbox is cleared)
  useEffect(() => {
    if (!mapInstance) return;

    // Reset selection rectangle if bbox is cleared and we're not drawing
    if (!selectedBbox && !isDrawingRef.current && selectionRectangleRef.current) {
      selectionRectangleRef.current.setMap(null);
      selectionRectangleRef.current = null;
    }

    // Restore selected rectangle if state contains a static bbox (e.g. loading or completed drawing)
    if (selectedBbox && !isDrawingRef.current) {
      if (selectionRectangleRef.current) {
        selectionRectangleRef.current.setMap(null);
      }

      const [minLat, minLon, maxLat, maxLon] = selectedBbox;
      selectionRectangleRef.current = new google.maps.Rectangle({
        map: mapInstance,
        strokeColor: '#ef4444',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#ef4444',
        fillOpacity: 0.15,
        bounds: {
          north: maxLat,
          south: minLat,
          east: maxLon,
          west: minLon,
        },
      });
    }
  }, [mapInstance, selectedBbox]);

  // Sync Search Results Markers
  useEffect(() => {
    if (!mapInstance) return;

    // Clear old result markers
    resultsMarkersRef.current.forEach(m => m.setMap(null));
    resultsMarkersRef.current = [];

    if (!infoWindowRef.current) {
      infoWindowRef.current = new google.maps.InfoWindow();
    }

    results.forEach(r => {
      const marker = new google.maps.Marker({
        map: mapInstance,
        position: { lat: r.lat, lng: r.lon },
        title: r.name,
      });

      marker.addListener('click', () => {
        const contentString = `
          <div style="padding: 4px; min-width: 150px; font-family: sans-serif;">
            <h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight: bold; color: #0f172a;">${r.name}</h4>
            <p style="margin: 0 0 4px 0; font-size: 12px; color: #64748b; font-weight: 500;">${r.category}</p>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #334155;">${r.address}</p>
            ${r.phone && r.phone !== 'N/A' ? `
              <p style="margin: 4px 0 0 0; font-size: 12px; font-family: monospace; color: #2563eb;">
                <span>📞</span> ${r.phone}
              </p>
            ` : ''}
          </div>
        `;
        infoWindowRef.current!.setContent(contentString);
        infoWindowRef.current!.open(mapInstance, marker);
      });

      resultsMarkersRef.current.push(marker);
    });
  }, [mapInstance, results]);

  return (
    <div
      ref={mapRef}
      className="w-full h-full"
      style={{ minHeight: '300px' }}
    />
  );
}
