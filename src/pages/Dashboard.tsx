import { useEffect, useState } from 'react';
import { useScraping } from '../context/ScrapingContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Map from '../components/Map';

interface Session {
  id: string;
  location: string;
  category: string;
  radius_km: number;
  result_count: number;
  created_at: string;
}

export default function Dashboard() {
  const {
    location, setLocation,
    radius, setRadius,
    limit, setLimit,
    category, setCategory,
    setIsScraping,
    setResults,
    dataFields, setDataFields,
    mapCenter, setMapCenter,
    selectionMode, setSelectionMode,
    selectedBbox, setSelectedBbox
  } = useScraping();

  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);

  const fetchSessions = async () => {
    const { data } = await supabase
      .from('scraping_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(8);
    if (data) setSessions(data as Session[]);
  };

  useEffect(() => { fetchSessions(); }, []);

  const handleStartScraping = async () => {
    if (selectionMode && !selectedBbox) {
      alert('Please click and drag on the map to select the custom area first.');
      return;
    }

    if (!location.trim()) {
      alert('Please enter a location or draw a custom area on the map');
      return;
    }

    setIsScraping(true);
    setResults([]);
    navigate('/results');

    try {
      const { data, error } = await supabase.functions.invoke('scrape', {
        body: { 
          location, 
          category, 
          radius, 
          limit, 
          mapCenter, 
          requiredFields: dataFields,
          bbox: selectionMode ? selectedBbox : null
        }
      });

      if (error) {
        console.error('Supabase Edge Function Error:', error);
        alert('Failed to extract data. See console for details.');
        setIsScraping(false);
        return;
      }

      if (data?.results && Array.isArray(data.results)) {
        setResults(data.results);
      } else {
        console.error('Invalid data received:', data);
        alert('Received invalid data format.');
      }
      setIsScraping(false);
      fetchSessions();
    } catch (err) {
      console.error('Extraction Error:', err);
      alert('An error occurred during extraction.');
      setIsScraping(false);
    }
  };

  const handleLoadSession = async (s: Session) => {
    setIsScraping(true);
    setLocation(s.location);
    setCategory(s.category);
    setRadius(s.radius_km);
    navigate('/results');

    const { data, error } = await supabase
      .from('scraped_results')
      .select('*')
      .eq('session_id', s.id);

    if (!error && data) {
      setResults(data.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        name: r.name as string,
        category: r.category as string,
        address: (r.address as string) || '',
        phone: (r.phone as string) || 'N/A',
        website: (r.website as string) || undefined,
        lat: r.lat as number,
        lon: r.lon as number,
      })));
    } else {
      alert('Failed to load session results.');
    }
    setIsScraping(false);
  };

  const handleResetFilters = () => {
    setLocation('');
    setRadius(15);
    setCategory('All Categories');
    setDataFields(['name', 'phone', 'address', 'website']);
    setSelectionMode(false);
    setSelectedBbox(null);
  };

  const toggleDataField = (field: string) => {
    if (dataFields.includes(field)) {
      setDataFields(dataFields.filter(f => f !== field));
    } else {
      setDataFields([...dataFields, field]);
    }
  };

  const availableCategories = [
    'All Categories',
    ...[
      'Accountants', 'Advertising Agencies', 'Air Conditioning Contractors', 'Airlines', 'Airports',
      'Amusement Parks', 'Animal Hospitals', 'Antiques', 'Apartments', 'Appliance Repair',
      'Architects', 'Art Galleries', 'Attorneys', 'Auto Body Shops', 'Auto Dealers',
      'Auto Parts', 'Auto Repair', 'Bakeries', 'Banks', 'Barbers',
      'Bars', 'Beauty Salons', 'Bicycles', 'Bookstores', 'Bowling Alleys',
      'Buses', 'Butchers', 'Cafes', 'Campgrounds', 'Car Rental',
      'Car Washes', 'Carpenters', 'Carpet Cleaning', 'Caterers', 'Cemeteries',
      'Child Care', 'Chiropractors', 'Churches', 'Cleaners', 'Clinics',
      'Clothing', 'Coffee Shops', 'Colleges', 'Computer Repair', 'Contractors',
      'Convenience Stores', 'Cosmetics', 'Credit Unions', 'Day Spas', 'Delis',
      'Dentists', 'Department Stores', 'Dermatologists', 'Desserts', 'Doctors',
      'Dog Walkers', 'Dry Cleaners', 'Electricians', 'Electronics', 'Employment Agencies',
      'Engineers', 'Entertainers', 'Event Planners', 'Fast Food', 'Financial Planners',
      'Fire Stations', 'Fitness Centers', 'Florists', 'Funeral Homes', 'Furniture',
      'Gas Stations', 'Gift Shops', 'Golf Courses', 'Groceries', 'Gyms',
      'Hair Salons', 'Hardware Stores', 'Health Food', 'Heating Contractors', 'Hospitals',
      'Hotels', 'Ice Cream', 'Insurance', 'Interior Designers', 'Internet Service Providers',
      'Investment Services', 'Jewelry', 'Landscaping', 'Laundromats', 'Lawyers',
      'Libraries', 'Liquor Stores', 'Locksmiths', 'Lumber', 'Massage',
      'Medical Centers', 'Mexican Restaurants', 'Mortgages', 'Motels', 'Movie Theaters',
      'Moving Companies', 'Museums', 'Nail Salons', 'Night Clubs', 'Nurseries',
      'Optometrists', 'Orthodontists', 'Painters', 'Parks', 'Pest Control',
      'Pet Stores', 'Pharmacies', 'Photographers', 'Physical Therapists', 'Physicians',
      'Pizza', 'Plumbers', 'Police Stations', 'Post Offices', 'Printers',
      'Property Management', 'Psychologists', 'Pubs', 'Real Estate', 'Restaurants',
      'Roofers', 'Schools', 'Security', 'Shoe Stores', 'Shopping Centers',
      'Signs', 'Spas', 'Sporting Goods', 'Storage', 'Supermarkets',
      'Sushi', 'Tailors', 'Tattoos', 'Tax Preparation', 'Taxis',
      'Theaters', 'Tires', 'Towing', 'Travel Agencies', 'Tree Service',
      'Universities', 'Urgent Care', 'Used Cars', 'Vegetarian Restaurants', 'Veterinarians',
      'Video Games', 'Vitamins', 'Warehouses', 'Waste Management', 'Web Design',
      'Wedding Planning', 'Wholesalers', 'Wineries', "Women's Clothing", 'Yoga'
    ].sort()
  ];

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Left Sidebar (Control Panel) */}
      <aside className="w-full md:w-[32%] bg-slate-50 dark:bg-slate-950 flex flex-col h-full border-r-0 shadow-sm z-40 overflow-y-auto custom-scrollbar">
        <div className="p-6 flex flex-col gap-8">
          {/* Section Header */}
          <div>
            <h2 className="font-headline font-bold text-lg text-slate-900 dark:text-slate-100">Control Panel</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Extraction Parameters</p>
          </div>

          {/* 1. Location Input & Selection */}
          <div className="space-y-4">
            <label className="block text-[0.75rem] font-bold uppercase tracking-wider text-outline">Location & Selection</label>
            
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const newMode = !selectionMode;
                  setSelectionMode(newMode);
                  if (newMode) {
                    setMapCenter(null);
                  } else {
                    setSelectedBbox(null);
                  }
                }}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold transition-all border shadow-sm ${
                  selectionMode
                    ? 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/30'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-outline-variant/30 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">crop_free</span>
                {selectionMode ? 'Interactive Map Mode' : 'Draw Custom Area'}
              </button>

              {selectedBbox && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBbox(null);
                    setLocation('');
                  }}
                  className="px-3 py-2.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 shadow-sm"
                >
                  Clear Area
                </button>
              )}
            </div>

            {selectionMode ? (
              <div className="p-3 bg-red-50/50 dark:bg-red-950/10 border border-red-100 dark:border-red-950/20 rounded-lg text-xs text-red-600 dark:text-red-400 space-y-1">
                <p className="font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">gesture</span> Click & Drag Map Selection
                </p>
                <p className="opacity-90 leading-relaxed">
                  Hold down click and drag from point to point on the map to define your selection rectangle. Map movement is locked while drawing.
                </p>
              </div>
            ) : (
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg" data-icon="location_on">location_on</span>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => {
                    setLocation(e.target.value);
                    setMapCenter(null);
                    setSelectedBbox(null);
                  }}
                  className="w-full pl-10 pr-4 py-3 bg-surface-container-lowest border-none rounded-lg shadow-sm focus:ring-2 focus:ring-primary/20 text-sm font-body"
                  placeholder="Enter city or area"
                />
              </div>
            )}

            {!selectionMode && (
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-on-surface-variant">Radius (km)</span>
                  <span className="text-xs font-bold text-primary">{radius} km</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="20"
                  step="0.1"
                  value={radius}
                  onChange={(e) => setRadius(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-surface-variant rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>
            )}
          </div>

          {/* 2. Data Filters */}
          <div className="space-y-4">
            <label className="block text-[0.75rem] font-bold uppercase tracking-wider text-outline">Data Filters</label>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-on-surface-variant">Business Category</label>
              <div className="relative">
                <input
                  type="text"
                  list="categories"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-container-lowest border-none rounded-lg shadow-sm text-sm font-body focus:ring-2 focus:ring-primary/20"
                  placeholder="E.g., Restaurants"
                />
                <datalist id="categories">
                  {availableCategories.map(cat => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none" data-icon="search">search</span>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-on-surface-variant">Data Fields</label>
              <div className="flex flex-wrap gap-2">
                {['name', 'phone', 'address', 'website'].map((field) => (
                  <button
                    key={field}
                    onClick={() => toggleDataField(field)}
                    className={`px-3 py-1.5 rounded-lg shadow-sm text-xs font-semibold flex items-center gap-1 border transition-colors ${
                      dataFields.includes(field)
                        ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 border-primary/10'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-transparent'
                    }`}
                  >
                    {dataFields.includes(field) && (
                      <span className="material-symbols-outlined text-[14px]" data-icon="check" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                    )}
                    {field.charAt(0).toUpperCase() + field.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3. Settings */}
          <div className="space-y-4">
            <label className="block text-[0.75rem] font-bold uppercase tracking-wider text-outline">Settings</label>
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-on-surface-variant">Max results limit</label>
              <input
                type="number"
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value))}
                className="w-full px-4 py-3 bg-surface-container-lowest border-none rounded-lg shadow-sm text-sm font-mono focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* 4. Actions */}
          <div className="pt-4 flex flex-col gap-3">
            <button
              onClick={handleStartScraping}
              className="w-full py-4 bg-gradient-to-br from-primary to-primary-container text-white rounded-lg font-headline font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform active:scale-95"
            >
              Start Scraping
            </button>
            <button
              onClick={handleResetFilters}
              className="w-full py-3 bg-surface-container-highest text-on-surface rounded-lg font-headline font-semibold text-sm hover:bg-surface-variant transition-colors"
            >
              Reset Filters
            </button>
          </div>

          {/* 5. Recent Sessions */}
          {sessions.length > 0 && (
            <div className="space-y-3 pb-4">
              <label className="block text-[0.75rem] font-bold uppercase tracking-wider text-outline">Recent Sessions</label>
              <div className="flex flex-col gap-2">
                {sessions.map(s => (
                  <button
                    key={s.id}
                    onClick={() => handleLoadSession(s)}
                    className="w-full text-left p-3 bg-surface-container-lowest rounded-lg shadow-sm hover:bg-surface-container-high transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-on-surface truncate">{s.location}</div>
                        <div className="text-[11px] text-on-surface-variant truncate">{s.category}</div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <div className="text-[11px] font-semibold text-primary">{s.result_count} results</div>
                        <div className="text-[10px] text-outline">{formatDate(s.created_at)}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Right Side (Map & Results) */}
      <section className="flex-1 flex flex-col h-full bg-surface-container-low overflow-hidden">
        <div className="h-[40%] min-h-[300px] w-full relative group">
          <Map />
          <div className="absolute inset-0 bg-primary/5 pointer-events-none z-20"></div>
        </div>

        <div className="flex-1 flex flex-col p-6 overflow-hidden">
          <div className="flex justify-between items-end mb-6">
            <div>
              <h3 className="font-headline font-bold text-xl text-on-surface">Ready to Extract</h3>
              <p className="text-sm text-outline">Configure parameters to begin.</p>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center opacity-50">
            <div className="text-center">
              <span className="material-symbols-outlined text-6xl text-outline mb-4">manage_search</span>
              <p className="text-outline font-semibold">Awaiting Extraction...</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
