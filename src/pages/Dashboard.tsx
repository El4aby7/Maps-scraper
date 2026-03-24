import { useScraping } from '../context/ScrapingContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Map from '../components/Map';

export default function Dashboard() {
  const {
    location, setLocation,
    radius, setRadius,
    category, setCategory,
    setIsScraping,
    setResults
  } = useScraping();

  const navigate = useNavigate();

  const handleStartScraping = async () => {
    if (!location.trim()) {
        alert("Please enter a location");
        return;
    }

    setIsScraping(true);
    setResults([]); // Clear previous results
    navigate('/results');

    try {
      const { data, error } = await supabase.functions.invoke('scrape', {
        body: { location, category, radius }
      });

      if (error) {
        console.error('Supabase Edge Function Error:', error);
        alert('Failed to extract data. See console for details.');
        setIsScraping(false);
        return;
      }

      // Simulate network delay to show off the loading state
      setTimeout(() => {
        if (data && Array.isArray(data)) {
            setResults(data);
        } else {
            console.error('Invalid data received:', data);
            alert('Received invalid data format.');
        }
        setIsScraping(false);
      }, 1500);

    } catch (err) {
      console.error('Extraction Error:', err);
      alert('An error occurred during extraction.');
      setIsScraping(false);
    }
  };

  const handleResetFilters = () => {
    setLocation('');
    setRadius(15);
    setCategory('Restaurants & Cafes');
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

          {/* 1. Location Input */}
          <div className="space-y-4">
            <label className="block text-[0.75rem] font-bold uppercase tracking-wider text-outline">Location Input</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg" data-icon="location_on">location_on</span>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-surface-container-lowest border-none rounded-lg shadow-sm focus:ring-2 focus:ring-primary/20 text-sm font-body"
                placeholder="Enter city or area"
              />
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-on-surface-variant">Radius (km)</span>
                <span className="text-xs font-bold text-primary">{radius} km</span>
              </div>
              <input
                type="range"
                min="1"
                max="100"
                value={radius}
                onChange={(e) => setRadius(parseInt(e.target.value))}
                className="w-full h-1.5 bg-surface-variant rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>
          </div>

          {/* 2. Data Filters */}
          <div className="space-y-4">
            <label className="block text-[0.75rem] font-bold uppercase tracking-wider text-outline">Data Filters</label>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-on-surface-variant">Business Category</label>
              <div className="relative">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full appearance-none px-4 py-3 bg-surface-container-lowest border-none rounded-lg shadow-sm text-sm font-body focus:ring-2 focus:ring-primary/20"
                >
                  <option>Restaurants & Cafes</option>
                  <option>Medical Services</option>
                  <option>Retail Stores</option>
                  <option>Automotive</option>
                  <option>Coffee Shops</option>
                  <option>Hotels</option>
                  <option>Gyms</option>
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none" data-icon="expand_more">expand_more</span>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-on-surface-variant">Data Fields</label>
              <div className="flex flex-wrap gap-2">
                <button className="px-3 py-1.5 bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 rounded-lg shadow-sm text-xs font-semibold flex items-center gap-1 border border-primary/10">
                  <span className="material-symbols-outlined text-[14px]" data-icon="check" style={{ fontVariationSettings: "'FILL' 1" }}>check</span> Name
                </button>
                <button className="px-3 py-1.5 bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 rounded-lg shadow-sm text-xs font-semibold flex items-center gap-1 border border-primary/10">
                  <span className="material-symbols-outlined text-[14px]" data-icon="check" style={{ fontVariationSettings: "'FILL' 1" }}>check</span> Phone
                </button>
                <button className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg text-xs font-medium">Rating</button>
                <button className="px-3 py-1.5 bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 rounded-lg shadow-sm text-xs font-semibold flex items-center gap-1 border border-primary/10">
                  <span className="material-symbols-outlined text-[14px]" data-icon="check" style={{ fontVariationSettings: "'FILL' 1" }}>check</span> Address
                </button>
                <button className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg text-xs font-medium">Reviews</button>
              </div>
            </div>
          </div>

          {/* 3. Settings */}
          <div className="space-y-4">
            <label className="block text-[0.75rem] font-bold uppercase tracking-wider text-outline">Settings</label>

            <div className="flex items-center justify-between p-3 bg-surface-container-low rounded-lg">
              <span className="text-xs font-semibold text-on-surface-variant">Include only verified</span>
              <button className="w-10 h-5 bg-tertiary/20 rounded-full relative transition-colors">
                <div className="absolute right-1 top-1 w-3 h-3 bg-tertiary rounded-full shadow-sm"></div>
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-on-surface-variant">Max results limit</label>
              <input type="number" defaultValue="500" className="w-full px-4 py-3 bg-surface-container-lowest border-none rounded-lg shadow-sm text-sm font-mono focus:ring-2 focus:ring-primary/20" />
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
        </div>
      </aside>

      {/* Right Side (Map & Results) */}
      <section className="flex-1 flex flex-col h-full bg-surface-container-low overflow-hidden">
        {/* Map Container */}
        <div className="h-[40%] min-h-[300px] w-full relative group">
          <Map />
          <div className="absolute inset-0 bg-primary/5 pointer-events-none z-20"></div>
        </div>

        {/* Results Section */}
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