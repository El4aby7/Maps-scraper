import { Link, useLocation, useNavigate } from 'react-router-dom';

export function TopNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <header className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl docked full-width top-0 sticky z-50 shadow-sm shadow-blue-900/5 flex justify-between items-center w-full px-6 py-4 max-w-full mx-auto">
      <div className="flex items-center gap-8">
        <span className="text-xl font-extrabold text-blue-700 dark:text-blue-500 tracking-tighter font-headline">MapExtract Pro</span>
        <nav className="hidden md:flex gap-6 items-center">
          <Link
            to="/"
            className={`font-manrope text-lg tracking-tight transition-colors ${
              location.pathname === '/'
                ? 'text-blue-700 dark:text-blue-400 font-bold border-b-2 border-blue-600 pb-1'
                : 'text-slate-500 dark:text-slate-400 hover:text-blue-600'
            }`}
          >
            Dashboard
          </Link>
          <Link
            to="/results"
            className={`font-manrope text-lg tracking-tight transition-colors ${
              location.pathname.startsWith('/results')
                ? 'text-blue-700 dark:text-blue-400 font-bold border-b-2 border-blue-600 pb-1'
                : 'text-slate-500 dark:text-slate-400 hover:text-blue-600'
            }`}
          >
            Results
          </Link>
        </nav>
      </div>
      <button
        onClick={() => navigate('/')}
        className="bg-primary-container text-on-primary-container px-5 py-2 rounded-lg font-headline font-bold text-sm hover:opacity-90 transition-all active:scale-95 duration-150 ease-in-out"
      >
        Start Extraction
      </button>
    </header>
  );
}