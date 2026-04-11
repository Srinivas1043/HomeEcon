import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Trackers from './pages/Trackers';
import Grocery from './pages/Grocery';
import Accounts from './pages/Accounts';
import Settings from './pages/Settings';
import Advisor from './pages/Advisor';
import Layout from './components/Layout';
import './index.css';

function App() {
  const [configError, setConfigError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      setConfigError('Supabase environment variables are missing. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your Vercel Project Settings.');
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setConfigError('Failed to connect to Supabase. Check your URL and Key.');
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: any, session: Session | null) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (configError) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh', 
        padding: '20px',
        textAlign: 'center',
        background: '#0f172a',
        color: '#f8fafc',
        fontFamily: 'sans-serif'
      }}>
        <h2 style={{ color: '#ef4444' }}>Configuration Error</h2>
        <p style={{ maxWidth: '500px', lineHeight: '1.6', opacity: 0.8 }}>{configError}</p>
        <div style={{ marginTop: '24px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '14px' }}>
          Check <b>Settings &rarr; Environment Variables</b> in your Vercel Dashboard.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: '#0f172a',
        color: '#f8fafc'
      }}>
        <div className="spinner" style={{ marginBottom: '20px' }}></div>
        Loading HomeEcon...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/login" 
          element={!session ? <Auth /> : <Navigate to="/" replace />} 
        />
        <Route 
          path="/" 
          element={session ? <Layout /> : <Navigate to="/login" replace />}
        >
          <Route index element={<Dashboard />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="trackers" element={<Trackers />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="grocery" element={<Grocery />} />
          <Route path="advisor" element={<Advisor />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
