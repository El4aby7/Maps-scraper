import { Outlet } from 'react-router-dom';
import { TopNav } from './TopNav';

export default function Layout() {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-surface text-on-surface antialiased">
      <TopNav />
      <main className="flex-1 overflow-hidden relative">
        <Outlet />
      </main>
    </div>
  );
}