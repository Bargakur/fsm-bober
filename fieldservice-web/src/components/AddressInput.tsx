import { useState, useRef, useEffect } from 'react';
import { MapPin, Crosshair, X } from 'lucide-react';
import L from 'leaflet';

/*
 * Google Places Autocomplete — session-based billing (~$0.017 per session).
 * Cost guards:
 *  1. Uses Autocomplete WIDGET (not AutocompleteService) → auto session tokens
 *  2. Restricted to Poland only → fewer irrelevant results
 *  3. Restricted to type "address" → no POI/business noise
 *  4. Max 50 sessions per page load (hard cap — prevents runaway costs)
 *  5. Widget handles debouncing internally
 *
 * At $0.017/session, 50 sessions = ~$0.85 max per page load.
 * Monthly $200 free credit ≈ 11,700 sessions before any charge.
 */

const MAX_SESSIONS_PER_LOAD = 50;
let sessionCount = 0;

interface Props {
  value: string;
  lat: number | null;
  lng: number | null;
  onChange: (address: string, lat: number | null, lng: number | null) => void;
}

export default function AddressInput({ value, lat, lng, onChange }: Props) {
  const [showMap, setShowMap] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Initialize Google Places Autocomplete (with retry if API not loaded yet)
  useEffect(() => {
    if (autocompleteRef.current) return;

    const init = () => {
      if (!inputRef.current) return false;
      if (typeof google === 'undefined' || !google.maps?.places) return false;

      const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'pl' },
        types: ['address'],
        fields: ['formatted_address', 'geometry'],
      });

      autocomplete.addListener('place_changed', () => {
        sessionCount++;
        if (sessionCount >= MAX_SESSIONS_PER_LOAD) {
          setLimitReached(true);
        }

        const place = autocomplete.getPlace();
        if (place.geometry?.location) {
          const pLat = place.geometry.location.lat();
          const pLng = place.geometry.location.lng();
          const addr = place.formatted_address || '';
          onChange(addr, pLat, pLng);

          if (mapRef.current) {
            mapRef.current.setView([pLat, pLng], 17);
            updateMarker(pLat, pLng);
          }
        }
      });

      autocompleteRef.current = autocomplete;
      return true;
    };

    // Try immediately, then retry every 500ms until API loads (max 10s)
    if (init()) return;
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (init() || attempts > 20) clearInterval(interval);
    }, 500);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync input value for controlled component (Google widget manages its own value,
  // but we need to set it when form resets or external changes come in)
  useEffect(() => {
    if (inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.value = value;
    }
  }, [value]);

  const handleManualInput = () => {
    if (inputRef.current) {
      onChange(inputRef.current.value, null, null);
    }
  };

  // ---- Leaflet map for manual pin ----

  const updateMarker = (mLat: number, mLng: number) => {
    if (!mapRef.current) return;
    if (markerRef.current) {
      markerRef.current.setLatLng([mLat, mLng]);
    } else {
      markerRef.current = L.marker([mLat, mLng], {
        draggable: true,
        icon: L.divIcon({
          className: 'addr-map-pin',
          html: '<div class="addr-pin-dot"></div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
      }).addTo(mapRef.current);

      markerRef.current.on('dragend', () => {
        const pos = markerRef.current!.getLatLng();
        reverseGeocode(pos.lat, pos.lng);
      });
    }
  };

  const reverseGeocode = async (rLat: number, rLng: number) => {
    onChange(inputRef.current?.value || '', rLat, rLng);
    if (typeof google === 'undefined' || !google.maps) return;

    try {
      const geocoder = new google.maps.Geocoder();
      const result = await geocoder.geocode({ location: { lat: rLat, lng: rLng } });
      if (result.results[0]) {
        const addr = result.results[0].formatted_address;
        if (inputRef.current) inputRef.current.value = addr;
        onChange(addr, rLat, rLng);
      }
    } catch {
      // keep coords even if reverse geocode fails
    }
  };

  useEffect(() => {
    if (!showMap) {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
      return;
    }

    const timer = setTimeout(() => {
      if (!mapContainerRef.current || mapRef.current) return;

      const centerLat = lat || 52.2297;
      const centerLng = lng || 21.0122;
      const zoom = lat ? 17 : 12;

      const map = L.map(mapContainerRef.current, {
        center: [centerLat, centerLng],
        zoom,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      map.on('click', (e: L.LeafletMouseEvent) => {
        updateMarker(e.latlng.lat, e.latlng.lng);
        reverseGeocode(e.latlng.lat, e.latlng.lng);
      });

      mapRef.current = map;

      if (lat && lng) {
        updateMarker(lat, lng);
      }

      setTimeout(() => map.invalidateSize(), 100);
    }, 50);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMap]);

  const hasCoords = lat !== null && lng !== null;

  return (
    <div className="addr-input-wrapper" ref={wrapperRef}>
      <div className="addr-input-row">
        <div className="addr-input-field">
          <input
            ref={inputRef}
            type="text"
            placeholder="ul. Marszałkowska 10/5, Warszawa"
            defaultValue={value}
            onChange={handleManualInput}
            className="addr-text-input"
            disabled={limitReached}
          />
          {hasCoords && (
            <span className="addr-coords-badge" title={`${lat!.toFixed(5)}, ${lng!.toFixed(5)}`}>
              <MapPin size={12} /> GPS
            </span>
          )}
        </div>
        <button
          type="button"
          className={`addr-map-toggle ${showMap ? 'active' : ''}`}
          onClick={() => setShowMap(!showMap)}
          title={showMap ? 'Ukryj mapę' : 'Wybierz na mapie'}
        >
          <Crosshair size={16} />
        </button>
      </div>

      {limitReached && (
        <div className="addr-limit-warning">
          Limit wyszukiwań osiągnięty. Użyj mapki poniżej aby wskazać adres ręcznie.
        </div>
      )}

      {/* Map picker — fallback for manual pin */}
      {showMap && (
        <div className="addr-map-wrapper">
          <div className="addr-map-toolbar">
            <span className="addr-map-hint">Kliknij na mapę aby ustawić pinezkę lub przeciągnij marker</span>
            <button type="button" className="addr-map-close" onClick={() => setShowMap(false)}>
              <X size={14} />
            </button>
          </div>
          <div ref={mapContainerRef} className="addr-map-container" />
        </div>
      )}
    </div>
  );
}
