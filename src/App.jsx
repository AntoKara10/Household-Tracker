import { Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { useAuth } from './lib/AuthContext.jsx';
import { supabase } from './lib/supabaseClient';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Entries from './pages/Entries.jsx';
import MasterData from './pages/MasterData.jsx';
import Household from './pages/Household.jsx';

function Shell({ children }) {
  const { profile } = useAuth();
  return (
    <div className="app-shell">
      <nav className="sidebar">
        <div className="brand">Flow<span>Track</span></div>
        <NavLink to="/" end className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>Dashboard</NavLink>
        <NavLink to="/entries" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>Entries</NavLink>
        <NavLink to="/master-data" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>Master data</NavLink>
        <NavLink to="/household" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>Household</NavLink>
        <div style={{ flex: 1 }} />
        <div style={{ padding: '0 8px', fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>
          {profile?.display_name}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => supabase.auth.signOut()}>Log out</button>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}

export default function App() {
  const { session, loading } = useAuth();

  if (loading) return <div style={{ padding: 40, color: 'var(--text-dim)' }}>Loading…</div>;
  if (!session) return <Login />;

  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/entries" element={<Entries />} />
        <Route path="/master-data" element={<MasterData />} />
        <Route path="/household" element={<Household />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
