import { useMemo, useState } from 'react';
import { useScraping, type ScrapedResult } from '../context/ScrapingContext';
import Papa from 'papaparse';

const SOCIAL_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  x: 'X',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  whatsapp: 'WhatsApp',
};

// Link to the business's own Maps listing, never raw coordinates.
const googleMapsLink = (r: ScrapedResult) =>
  r.googleMapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name)}&query_place_id=${r.id}`;

const formatStatus = (status?: string) =>
  status ? status.replace(/_/g, ' ').toLowerCase() : '';

const phoneDigits = (phone?: string) => {
  if (!phone || phone === 'N/A') return '';
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 7 ? digits : '';
};

// Google returns international phone format, so wa.me accepts the bare digits
const whatsappLink = (r: ScrapedResult) => {
  if (r.socials?.whatsapp) return r.socials.whatsapp;
  const digits = phoneDigits(r.phone);
  return digits ? `https://wa.me/${digits}` : '';
};

const hasSocials = (r: ScrapedResult) => !!r.socials && Object.keys(r.socials).length > 0;

type SortKey = 'name' | 'rating';

const chipClass = (active: boolean) =>
  `px-3 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${
    active
      ? 'bg-primary text-on-primary'
      : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-highest'
  }`;

export default function Results() {
  const { results, isScraping, location, category, dataFields } = useScraping();
  const [selectedResult, setSelectedResult] = useState<ScrapedResult | null>(null);
  const [search, setSearch] = useState('');
  const [noWebsite, setNoWebsite] = useState(false);
  const [socialsOnly, setSocialsOnly] = useState(false);
  const [newOnly, setNewOnly] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const visibleResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = results.filter(r => {
      if (q && !`${r.name} ${r.address} ${r.phone}`.toLowerCase().includes(q)) return false;
      if (noWebsite && r.website) return false;
      if (socialsOnly && (r.website || !hasSocials(r))) return false;
      if (newOnly && r.seenBefore) return false;
      if (minRating > 0 && (r.rating ?? 0) < minRating) return false;
      return true;
    });
    if (!sort) return filtered;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sort.key === 'name') return a.name.localeCompare(b.name) * dir;
      const diff = (a.rating ?? 0) - (b.rating ?? 0);
      return (diff !== 0 ? diff : (a.userRatingCount ?? 0) - (b.userRatingCount ?? 0)) * dir;
    });
  }, [results, search, noWebsite, socialsOnly, newOnly, minRating, sort]);

  const noWebsiteCount = results.filter(r => !r.website).length;
  const socialsOnlyCount = results.filter(r => !r.website && hasSocials(r)).length;

  const toggleSort = (key: SortKey) => {
    const initial = key === 'name' ? 'asc' : 'desc';
    setSort(prev => {
      if (prev?.key !== key) return { key, dir: initial };
      if (prev.dir === initial) return { key, dir: initial === 'asc' ? 'desc' : 'asc' };
      return null;
    });
  };

  const sortArrow = (key: SortKey) =>
    sort?.key === key ? (sort.dir === 'asc' ? '↑' : '↓') : '';

  const copyToClipboard = (field: string, value: string) => {
    navigator.clipboard.writeText(value).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    }).catch(() => {});
  };

  const copyButton = (field: string, value: string | undefined, light = false) =>
    value && value !== 'N/A' ? (
      <button
        onClick={() => copyToClipboard(field, value)}
        title="Copy"
        className={`p-1 rounded transition-colors ${light ? 'text-white/70 hover:text-white' : 'text-outline hover:bg-surface-container-high'}`}
      >
        <span className="material-symbols-outlined text-[16px]">{copiedField === field ? 'check' : 'content_copy'}</span>
      </button>
    ) : null;

  const handleExportCSV = () => {
    if (visibleResults.length === 0) return;

    const exportData = visibleResults.map(r => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row: any = {};
      if (dataFields.includes('name')) row['Name'] = r.name;
      row['Category'] = r.category;
      if (dataFields.includes('address')) row['Address'] = r.address;
      if (dataFields.includes('phone')) row['Phone'] = r.phone;
      if (dataFields.includes('website')) row['Website'] = r.website || '';
      row['Rating'] = r.rating ?? '';
      row['Reviews'] = r.userRatingCount ?? '';
      row['Status'] = r.businessStatus || '';
      row['Seen Before'] = r.seenBefore ? 'yes' : '';
      row['Opening Hours'] = r.openingHours || '';
      Object.entries(SOCIAL_LABELS).forEach(([key, label]) => {
        row[label] = r.socials?.[key] || '';
      });
      row['Google Maps URL'] = googleMapsLink(r);
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
              {results.length > 0 && (
                <div className="mt-3 text-xs text-on-surface-variant font-label">
                  {noWebsiteCount} no website · {socialsOnlyCount} socials-only · showing {visibleResults.length}/{results.length}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Results Data Grid */}
        <section className="bg-surface-container-low rounded-xl overflow-hidden shadow-sm border border-outline-variant/30 pb-24">
          {/* Filter Bar */}
          <div className="px-4 py-3 bg-surface-container-high/50 border-b border-outline-variant/20 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, address, phone…"
                className="w-full pl-10 pr-4 py-2 bg-surface-container-lowest rounded-lg text-sm border-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <button onClick={() => setNoWebsite(v => !v)} className={chipClass(noWebsite)}>No website</button>
            <button onClick={() => setSocialsOnly(v => !v)} className={chipClass(socialsOnly)}>Socials only</button>
            <button onClick={() => setNewOnly(v => !v)} className={chipClass(newOnly)}>New only</button>
            <select
              value={minRating}
              onChange={e => setMinRating(parseFloat(e.target.value))}
              className="px-3 py-1.5 rounded-full bg-surface-container-lowest text-on-surface-variant text-xs font-bold border-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <option value={0}>Any rating</option>
              <option value={3}>3.0+</option>
              <option value={4}>4.0+</option>
              <option value={4.5}>4.5+</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-high">
                  {dataFields.includes('name') && (
                    <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-widest font-label">
                      <button onClick={() => toggleSort('name')} className="uppercase tracking-widest font-bold hover:text-on-surface transition-colors">
                        Business Name {sortArrow('name')}
                      </button>
                    </th>
                  )}
                  {dataFields.includes('address') && <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-widest font-label">Address</th>}
                  {dataFields.includes('phone') && <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-widest font-label">Phone</th>}
                  {dataFields.includes('website') && <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-widest font-label">Website / Socials</th>}
                  <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-widest font-label">
                    <button onClick={() => toggleSort('rating')} className="uppercase tracking-widest font-bold hover:text-on-surface transition-colors">
                      Rating {sortArrow('rating')}
                    </button>
                  </th>
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
                ) : visibleResults.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-on-surface-variant font-semibold">
                      No results match the current filters.
                    </td>
                  </tr>
                ) : (
                  visibleResults.map((result, idx) => (
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
                              <div className="text-xs text-on-surface-variant">
                                {result.category}
                                {result.businessStatus && result.businessStatus !== 'OPERATIONAL' && (
                                  <span className="ml-2 px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold uppercase">{formatStatus(result.businessStatus)}</span>
                                )}
                                {result.seenBefore && (
                                  <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold uppercase">seen before</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      )}
                      {dataFields.includes('address') && (
                        <td className="px-6 py-4 text-sm text-on-surface-variant max-w-[200px] truncate">{result.address}</td>
                      )}
                      {dataFields.includes('phone') && (
                        <td className="px-6 py-4 text-sm font-mono text-on-surface-variant whitespace-nowrap">
                          {phoneDigits(result.phone) ? (
                            <span className="flex items-center gap-2">
                              <a href={`tel:${result.phone}`} onClick={e => e.stopPropagation()} className="hover:text-primary hover:underline">{result.phone}</a>
                              <a
                                href={whatsappLink(result)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                title="Chat on WhatsApp"
                                className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center hover:bg-green-200 transition-colors flex-shrink-0"
                              >
                                <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>chat</span>
                              </a>
                            </span>
                          ) : (
                            result.phone
                          )}
                        </td>
                      )}
                      {dataFields.includes('website') && (
                        <td className="px-6 py-4">
                          {result.website ? (
                            <a href={result.website.startsWith('http') ? result.website : `https://${result.website}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm font-medium truncate max-w-[150px] inline-block" onClick={e => e.stopPropagation()}>
                              {result.website.replace(/^https?:\/\//, '')}
                            </a>
                          ) : result.socials && Object.keys(result.socials).length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(result.socials).map(([key, url]) => (
                                <a key={key} href={url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed text-xs font-bold hover:opacity-80 transition-opacity">
                                  {SOCIAL_LABELS[key] || key}
                                </a>
                              ))}
                            </div>
                          ) : (
                            <span className="text-sm text-outline italic">N/A</span>
                          )}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {result.rating ? (
                          <span className="text-sm font-semibold text-on-surface">
                            <span className="text-amber-500">★</span> {result.rating.toFixed(1)}{' '}
                            <span className="text-on-surface-variant font-normal">({result.userRatingCount ?? 0})</span>
                          </span>
                        ) : (
                          <span className="text-sm text-outline italic">N/A</span>
                        )}
                      </td>
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
            <span className="text-sm font-bold text-on-surface">
              {visibleResults.length > 0 ? `${visibleResults.length} lead${visibleResults.length === 1 ? '' : 's'} ready for export` : 'Waiting for Data'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              disabled={visibleResults.length === 0}
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
              <div className="relative h-48 w-full bg-slate-200">
                {selectedResult.image ? (
                  <img src={selectedResult.image} alt={selectedResult.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    <span className="material-symbols-outlined text-6xl">storefront</span>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-black/80 to-transparent">
                  <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                    {selectedResult.name}
                    {copyButton('name', selectedResult.name, true)}
                  </h2>
                  <p className="text-white/70 text-sm mt-1 flex items-center gap-2 flex-wrap">
                    <span>{selectedResult.category}</span>
                    {selectedResult.seenBefore && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-400/90 text-black text-[10px] font-bold uppercase">seen before</span>
                    )}
                    {selectedResult.rating && (
                      <span className="text-amber-400 font-semibold">★ {selectedResult.rating.toFixed(1)} ({selectedResult.userRatingCount ?? 0} reviews)</span>
                    )}
                    {selectedResult.businessStatus && selectedResult.businessStatus !== 'OPERATIONAL' && (
                      <span className="px-1.5 py-0.5 rounded bg-red-500/80 text-white text-[10px] font-bold uppercase">{formatStatus(selectedResult.businessStatus)}</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="px-8 py-4 bg-surface-container-low border-b border-surface-container-high flex gap-3">
                <a
                  href={googleMapsLink(selectedResult)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-sm rounded-lg transition-colors border border-blue-200"
                >
                  <span className="material-symbols-outlined text-sm">map</span>
                  View on Google Maps
                </a>
                {whatsappLink(selectedResult) && (
                  <a
                    href={whatsappLink(selectedResult)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-50 hover:bg-green-100 text-green-700 font-bold text-sm rounded-lg transition-colors border border-green-200"
                  >
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>chat</span>
                    WhatsApp
                  </a>
                )}
              </div>

              <div className="p-8 space-y-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-outline">Contact Information</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex items-start gap-4 p-4 bg-surface-container-low rounded-xl">
                    <span className="material-symbols-outlined text-primary">location_on</span>
                    <div className="flex-1">
                      <div className="text-xs font-bold text-outline uppercase tracking-tight mb-1">Full Address</div>
                      <div className="text-sm font-semibold text-on-surface">{selectedResult.address}</div>
                    </div>
                    {copyButton('address', selectedResult.address)}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-start gap-4 p-4 bg-surface-container-low rounded-xl">
                      <span className="material-symbols-outlined text-primary">call</span>
                      <div className="flex-1">
                        <div className="text-xs font-bold text-outline uppercase tracking-tight mb-1">Phone</div>
                        {phoneDigits(selectedResult.phone) ? (
                          <a href={`tel:${selectedResult.phone}`} className="text-sm font-semibold text-on-surface hover:text-primary hover:underline">{selectedResult.phone}</a>
                        ) : (
                          <div className="text-sm font-semibold text-on-surface">{selectedResult.phone}</div>
                        )}
                      </div>
                      {copyButton('phone', phoneDigits(selectedResult.phone) ? selectedResult.phone : undefined)}
                    </div>
                    <div className="flex items-start gap-4 p-4 bg-surface-container-low rounded-xl overflow-hidden">
                      <span className="material-symbols-outlined text-primary">public</span>
                      <div className="truncate">
                        <div className="text-xs font-bold text-outline uppercase tracking-tight mb-1">Website</div>
                        {selectedResult.website ? (
                          <a href={selectedResult.website} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-primary truncate block hover:underline">
                            {selectedResult.website.replace(/^https?:\/\//, '')}
                          </a>
                        ) : (
                          <div className="text-sm font-semibold text-on-surface-variant truncate">N/A</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {selectedResult.socials && Object.keys(selectedResult.socials).length > 0 && (
                  <>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-outline">Social Profiles</h3>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(selectedResult.socials).map(([key, url]) => (
                        <a
                          key={key}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 rounded-full bg-tertiary-fixed text-on-tertiary-fixed text-sm font-bold hover:opacity-80 transition-opacity"
                        >
                          <span className="material-symbols-outlined text-sm">link</span>
                          {SOCIAL_LABELS[key] || key}
                        </a>
                      ))}
                    </div>
                  </>
                )}

                {selectedResult.openingHours && (
                  <>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-outline">Opening Hours</h3>
                    <div className="flex items-start gap-4 p-4 bg-surface-container-low rounded-xl">
                      <span className="material-symbols-outlined text-primary">schedule</span>
                      <div className="text-sm font-semibold text-on-surface whitespace-pre-line">{selectedResult.openingHours}</div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
