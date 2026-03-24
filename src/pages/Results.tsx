import { useState } from 'react';
import { useScraping, type ScrapedResult } from '../context/ScrapingContext';
import Papa from 'papaparse';

export default function Results() {
  const { results, isScraping, location, category, dataFields } = useScraping();
  const [selectedResult, setSelectedResult] = useState<ScrapedResult | null>(null);

  const handleExportCSV = () => {
    if (results.length === 0) return;

    // Only export fields that the user selected in the Dashboard
    const exportData = results.map(r => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row: any = {};
      if (dataFields.includes('name')) row['Name'] = r.name;
      row['Category'] = r.category;
      if (dataFields.includes('rating')) row['Rating'] = r.rating;
      if (dataFields.includes('reviews')) row['Reviews'] = r.reviews;
      if (dataFields.includes('address')) row['Address'] = r.address;
      if (dataFields.includes('phone')) row['Phone'] = r.phone;
      if (dataFields.includes('website')) row['Website'] = r.website || '';
      return row;
    });

    const csv = Papa.unparse(exportData);

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `extraction_${location.replace(/\s+/g, '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex w-full h-full bg-surface relative">
      <div className="flex-1 p-6 md:p-10 bg-surface overflow-y-auto custom-scrollbar h-full">
        {/* Status Header */}
        <section className="mb-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed text-xs font-bold tracking-wider uppercase mb-3">
                {isScraping ? (
                  <span className="material-symbols-outlined text-sm mr-1 animate-spin">refresh</span>
                ) : (
                  <span className="material-symbols-outlined text-sm mr-1" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                )}
                {isScraping ? 'Extracting Data...' : 'Active Dataset'}
              </span>
              <h1 className="text-4xl font-extrabold tracking-tight text-on-surface font-headline">Extraction Results</h1>
              <p className="text-on-surface-variant mt-2 max-w-2xl font-body">Targeted search in {location || 'selected area'} for "{category}".</p>
            </div>

            <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-outline-variant/20 min-w-[280px]">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-semibold font-label uppercase tracking-widest ${isScraping ? 'text-primary' : 'text-tertiary'}`}>
                  Status: {isScraping ? 'In Progress' : 'Complete'}
                </span>
                <span className="text-sm font-bold text-on-surface font-label">{results.length} Found</span>
              </div>
              <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
                <div className={`h-full w-full ${isScraping ? 'bg-primary animate-pulse' : 'bg-tertiary'}`}></div>
              </div>
            </div>
          </div>
        </section>

        {/* Results Data Grid */}
        <section className="bg-surface-container-low rounded-xl overflow-hidden shadow-sm border border-outline-variant/30 pb-24">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-high">
                  {dataFields.includes('name') && <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-widest font-label">Business Name</th>}
                  {dataFields.includes('rating') && <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-widest font-label">Rating</th>}
                  {dataFields.includes('address') && <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-widest font-label">Address</th>}
                  {dataFields.includes('phone') && <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-widest font-label">Phone</th>}
                  {dataFields.includes('website') && <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-widest font-label">Website</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-variant/30">
                {results.length === 0 && !isScraping ? (
                   <tr>
                       <td colSpan={5} className="px-6 py-10 text-center text-on-surface-variant font-semibold">
                           No results found yet. Start an extraction from the Dashboard.
                       </td>
                   </tr>
                ) : isScraping && results.length === 0 ? (
                   <tr>
                       <td colSpan={5} className="px-6 py-10 text-center text-on-surface-variant font-semibold animate-pulse">
                           Extracting data...
                       </td>
                   </tr>
                ) : (
                    results.map((result, idx) => (
                        <tr
                            key={result.id}
                            onClick={() => setSelectedResult(result)}
                            className={`${idx % 2 === 0 ? 'bg-surface-container-lowest' : ''} hover:bg-surface-container-highest transition-colors cursor-pointer group`}
                        >
                            {dataFields.includes('name') && (
                              <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-lg bg-primary-fixed flex items-center justify-center text-primary flex-shrink-0">
                                          <span className="material-symbols-outlined">storefront</span>
                                      </div>
                                      <div>
                                          <div className="font-bold text-on-surface line-clamp-1">{result.name}</div>
                                          <div className="text-xs text-on-surface-variant">{result.category}</div>
                                      </div>
                                  </div>
                              </td>
                            )}
                            {dataFields.includes('rating') && (
                              <td className="px-6 py-4">
                                  <div className="flex items-center gap-1 text-on-surface font-medium">
                                      <span className="material-symbols-outlined text-sm text-yellow-500" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                                      {result.rating}
                                      {dataFields.includes('reviews') && <span className="text-xs text-outline">({result.reviews})</span>}
                                  </div>
                              </td>
                            )}
                            {dataFields.includes('address') && (
                              <td className="px-6 py-4 text-sm text-on-surface-variant max-w-[200px] truncate">{result.address}</td>
                            )}
                            {dataFields.includes('phone') && (
                              <td className="px-6 py-4 text-sm font-mono text-on-surface-variant whitespace-nowrap">{result.phone}</td>
                            )}
                            {dataFields.includes('website') && (
                              <td className="px-6 py-4">
                                  {result.website ? (
                                      <a href={result.website.startsWith('http') ? result.website : `https://${result.website}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm font-medium truncate max-w-[150px] inline-block" onClick={e => e.stopPropagation()}>
                                          {result.website.replace(/^https?:\/\//, '')}
                                      </a>
                                  ) : (
                                      <span className="text-sm text-outline italic">N/A</span>
                                  )}
                              </td>
                            )}
                        </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Floating Export Footer */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[40] w-full max-w-2xl px-4 pointer-events-none">
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-[20px] border border-outline-variant/30 shadow-2xl rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 pointer-events-auto">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/70 font-label">Bulk Operations</span>
            <span className="text-sm font-bold text-on-surface">{results.length > 0 ? 'Ready for Export' : 'Waiting for Data'}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
                onClick={handleExportCSV}
                disabled={results.length === 0}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-to-br from-primary to-primary-container text-on-primary font-bold text-sm hover:translate-y-[-2px] transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:hover:translate-y-0"
            >
              <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>download</span>
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Detail Slide Over */}
      {selectedResult && (
        <div className="fixed inset-0 bg-on-primary-fixed/20 backdrop-blur-sm z-[60] flex justify-end">
          <div className="w-full max-w-xl bg-surface-bright h-full shadow-2xl shadow-on-primary-fixed/30 flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-surface-container-high flex justify-between items-center bg-surface-container-lowest">
              <div className="flex items-center gap-2 text-outline">
                <span className="material-symbols-outlined text-sm">info</span>
                <span className="text-xs font-bold uppercase tracking-widest font-label">Extraction Detail</span>
              </div>
              <button onClick={() => setSelectedResult(null)} className="p-2 hover:bg-surface-container-high rounded-full transition-colors text-outline">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="relative h-64 w-full bg-slate-200">
                {selectedResult.image ? (
                   <img src={selectedResult.image} alt={selectedResult.name} className="w-full h-full object-cover" />
                ) : (
                   <div className="w-full h-full flex items-center justify-center text-slate-400">
                       <span className="material-symbols-outlined text-6xl">storefront</span>
                   </div>
                )}
                <div className="absolute bottom-0 left-0 w-full p-8 bg-gradient-to-t from-black/80 to-transparent">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex items-center text-yellow-400">
                      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                      <span className="text-sm font-bold ml-1 text-white">{selectedResult.rating}/5</span>
                    </div>
                  </div>
                  <h2 className="text-3xl font-extrabold text-white tracking-tight">{selectedResult.name}</h2>
                </div>
              </div>

              <div className="px-8 py-4 bg-surface-container-low border-b border-surface-container-high flex gap-3">
                 <a
                   href={`https://www.google.com/maps/search/?api=1&query=${selectedResult.lat},${selectedResult.lon}`}
                   target="_blank"
                   rel="noopener noreferrer"
                   className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-sm rounded-lg transition-colors border border-blue-200"
                 >
                    <span className="material-symbols-outlined text-sm">map</span>
                    View on Google Maps
                 </a>
              </div>

              <div className="p-8 space-y-8 pt-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-outline">Contact Information</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="flex items-start gap-4 p-4 bg-surface-container-low rounded-xl">
                      <span className="material-symbols-outlined text-primary">location_on</span>
                      <div>
                        <div className="text-xs font-bold text-outline uppercase tracking-tight mb-1">Full Address</div>
                        <div className="text-sm font-semibold text-on-surface">{selectedResult.address}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-start gap-4 p-4 bg-surface-container-low rounded-xl">
                        <span className="material-symbols-outlined text-primary">call</span>
                        <div>
                          <div className="text-xs font-bold text-outline uppercase tracking-tight mb-1">Phone</div>
                          <div className="text-sm font-semibold text-on-surface">{selectedResult.phone}</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-4 p-4 bg-surface-container-low rounded-xl overflow-hidden">
                        <span className="material-symbols-outlined text-primary">public</span>
                        <div className="truncate">
                          <div className="text-xs font-bold text-outline uppercase tracking-tight mb-1">Website</div>
                          <div className="text-sm font-semibold text-primary truncate">
                              {selectedResult.website ? selectedResult.website.replace(/^https?:\/\//, '') : 'N/A'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-outline">Extracted Fields</h3>
                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">RAW DATA READY</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex items-center justify-between p-3 bg-surface-container-low rounded-lg">
                      <span className="text-sm font-medium text-on-surface-variant">Category</span>
                      <span className="text-sm font-bold text-on-surface">{selectedResult.category}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-surface-container-low rounded-lg">
                      <span className="text-sm font-medium text-on-surface-variant">Reviews Count</span>
                      <span className="text-sm font-bold text-on-surface">{selectedResult.reviews} Verified Reviews</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}