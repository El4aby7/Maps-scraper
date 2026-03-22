import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Results from './pages/Results';
import { ScrapingProvider } from './context/ScrapingContext';

function App() {
  return (
    <ScrapingProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="results" element={<Results />} />
          </Route>
        </Routes>
      </Router>
    </ScrapingProvider>
  );
}

export default App;