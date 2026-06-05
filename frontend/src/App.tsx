import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard.tsx';
import Portfolios from './pages/Portfolios.tsx';
import Contacts from './pages/Contacts.tsx';
import OwnedNumbers from './pages/OwnedNumbers.tsx';
import CallerProfiles from './pages/CallerProfiles.tsx';
import RunKickoff from './pages/RunKickoff.tsx';
import Compliance from './pages/Compliance.tsx';
import Settings from './pages/Settings.tsx';

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/portfolios', label: 'Portfolios' },
  { to: '/contacts', label: 'Contacts' },
  { to: '/owned-numbers', label: 'Owned Numbers' },
  { to: '/caller-profiles', label: 'Caller Profiles' },
  { to: '/run', label: 'Run' },
  { to: '/compliance', label: 'Compliance' },
  { to: '/settings', label: 'Settings' },
];

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 flex">
        {/* Sidebar */}
        <aside className="w-56 bg-gray-900 text-white flex flex-col py-6 px-3 gap-1">
          <div className="px-3 mb-6">
            <h1 className="text-lg font-bold text-white">Talking Portfolio</h1>
            <p className="text-xs text-gray-400 mt-0.5">AI Voice Reports</p>
          </div>
          {navItems.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-800'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/portfolios" element={<Portfolios />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/owned-numbers" element={<OwnedNumbers />} />
            <Route path="/caller-profiles" element={<CallerProfiles />} />
            <Route path="/run" element={<RunKickoff />} />
            <Route path="/compliance" element={<Compliance />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
