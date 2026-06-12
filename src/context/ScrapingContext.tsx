import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const SETTINGS_KEY = 'mapextract:settings';

interface PersistedSettings {
  category?: string;
  radius?: number;
  limit?: number;
  dataFields?: string[];
}

function loadSettings(): PersistedSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export interface ScrapedResult {
  id: string;
  name: string;
  address: string;
  phone: string;
  website?: string;
  category: string;
  lat: number;
  lon: number;
  image?: string;
  googleMapsUri?: string;
  rating?: number;
  userRatingCount?: number;
  openingHours?: string;
  businessStatus?: string;
  socials?: Record<string, string>;
  seenBefore?: boolean;
}

interface ScrapingContextProps {
  results: ScrapedResult[];
  setResults: (results: ScrapedResult[]) => void;
  isScraping: boolean;
  setIsScraping: (isScraping: boolean) => void;
  location: string;
  setLocation: (location: string) => void;
  radius: number;
  setRadius: (radius: number) => void;
  limit: number;
  setLimit: (limit: number) => void;
  category: string;
  setCategory: (category: string) => void;
  dataFields: string[];
  setDataFields: (fields: string[]) => void;
  mapCenter: [number, number] | null;
  setMapCenter: (center: [number, number] | null) => void;
  selectionMode: boolean;
  setSelectionMode: (mode: boolean) => void;
  selectedBbox: [number, number, number, number] | null;
  setSelectedBbox: (bbox: [number, number, number, number] | null) => void;
}

const ScrapingContext = createContext<ScrapingContextProps | undefined>(undefined);

export const ScrapingProvider = ({ children }: { children: ReactNode }) => {
  const [results, setResults] = useState<ScrapedResult[]>([]);
  const [isScraping, setIsScraping] = useState(false);
  const [location, setLocation] = useState('');
  const [radius, setRadius] = useState(() => loadSettings().radius ?? 15);
  const [limit, setLimit] = useState(() => loadSettings().limit ?? 60);
  const [category, setCategory] = useState(() => loadSettings().category ?? 'All Categories');
  const [dataFields, setDataFields] = useState<string[]>(() => loadSettings().dataFields ?? ['name', 'phone', 'address', 'website']);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedBbox, setSelectedBbox] = useState<[number, number, number, number] | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ category, radius, limit, dataFields }));
    } catch {
      // storage unavailable — settings just won't persist
    }
  }, [category, radius, limit, dataFields]);

  return (
    <ScrapingContext.Provider
      value={{
        results, setResults,
        isScraping, setIsScraping,
        location, setLocation,
        radius, setRadius,
        limit, setLimit,
        category, setCategory,
        dataFields, setDataFields,
        mapCenter, setMapCenter,
        selectionMode, setSelectionMode,
        selectedBbox, setSelectedBbox,
      }}
    >
      {children}
    </ScrapingContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useScraping = () => {
  const context = useContext(ScrapingContext);
  if (context === undefined) {
    throw new Error('useScraping must be used within a ScrapingProvider');
  }
  return context;
};
