import { createContext, useContext, useState, type ReactNode } from 'react';

export interface ScrapedResult {
  id: string;
  name: string;
  rating: number;
  reviews: number;
  address: string;
  phone: string;
  website?: string;
  category: string;
  verified: boolean;
  status: 'Complete' | 'Reviewing';
  image?: string;
  socialLinks?: {
    instagram?: string;
    facebook?: string;
  };
  businessHours?: {
    mondayFriday?: string;
    saturday?: string;
    sunday?: string;
  }
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
  category: string;
  setCategory: (category: string) => void;
}

const ScrapingContext = createContext<ScrapingContextProps | undefined>(undefined);

export const ScrapingProvider = ({ children }: { children: ReactNode }) => {
  const [results, setResults] = useState<ScrapedResult[]>([]);
  const [isScraping, setIsScraping] = useState(false);
  const [location, setLocation] = useState('');
  const [radius, setRadius] = useState(15);
  const [category, setCategory] = useState('Restaurants & Cafes');

  return (
    <ScrapingContext.Provider
      value={{
        results,
        setResults,
        isScraping,
        setIsScraping,
        location,
        setLocation,
        radius,
        setRadius,
        category,
        setCategory
      }}
    >
      {children}
    </ScrapingContext.Provider>
  );
};

export const useScraping = () => {
  const context = useContext(ScrapingContext);
  if (context === undefined) {
    throw new Error('useScraping must be used within a ScrapingProvider');
  }
  return context;
};