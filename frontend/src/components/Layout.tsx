import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { LayoutDashboard, Receipt, ShoppingCart, Settings, LogOut, Hexagon, Activity, Wallet, BrainCircuit } from 'lucide-react';
import styles from './Layout.module.css';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path ? styles.active : '';

  return (
    <div className={styles.layout}>
      {/* Top Header */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <Hexagon size={24} color="var(--accent-primary)" />
          HomeEcon
        </div>
        
        <div className={styles.userProfile}>
          <Link to="/advisor" style={{ color: 'var(--accent-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
            <BrainCircuit size={20} />
          </Link>
          <Link to="/settings" style={{ color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
            <Settings size={20} />
          </Link>
          <button onClick={handleSignOut} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', fontSize: '13px' }}>
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {/* Main Scrollable Content */}
      <main className={styles.main}>
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className={styles.bottomNav}>
        <Link to="/" className={`${styles.navItem} ${isActive('/')}`}>
          <LayoutDashboard size={24} />
          <span>Home</span>
        </Link>
        <Link to="/transactions" className={`${styles.navItem} ${isActive('/transactions')}`}>
          <Receipt size={24} />
          <span>Ledger</span>
        </Link>
        <Link to="/accounts" className={`${styles.navItem} ${isActive('/accounts')}`}>
          <Wallet size={24} />
          <span>Wallets</span>
        </Link>
        <Link to="/trackers" className={`${styles.navItem} ${isActive('/trackers')}`}>
          <Activity size={24} />
          <span>Trackers</span>
        </Link>
        <Link to="/grocery" className={`${styles.navItem} ${isActive('/grocery')}`}>
          <ShoppingCart size={24} />
          <span>Grocery</span>
        </Link>
      </nav>
    </div>
  );
}
