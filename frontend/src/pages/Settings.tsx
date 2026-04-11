import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Settings as SettingsIcon, Users, Key } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Settings() {
  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    }
  });

  const { data: profile } = useQuery({
    queryKey: ['profile', session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session!.user.id)
        .maybeSingle();
      if (error) {
         console.error('Profile fetch error:', error);
         throw error;
      }
      return data;
    }
  });

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <SettingsIcon size={28} color="var(--accent-primary)" />
        <h2 style={{ fontSize: '24px', fontWeight: 600 }}>Preferences</h2>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-panel" style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={20} color="var(--accent-cyan)" /> Household Management
        </h3>
        
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px', lineHeight: '1.5' }}>
          Your data is securely isolated into your own Household. To invite roommates or family members to share your Dashboard, give them your unique Invite Code below. They can enter it when creating a new account.
        </p>

        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '20px', borderRadius: '12px', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>Your Invite Code</div>
            <div style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-main)', marginTop: '4px', letterSpacing: '2px' }}>
              {profile?.invite_code || 'Generating...'}
            </div>
          </div>
          
          <button 
            className="btn btn-outline" 
            onClick={() => {
              if (profile?.invite_code) {
                 navigator.clipboard.writeText(profile.invite_code);
                 alert('Code copied to clipboard!');
              }
            }}
          >
            Copy Code
          </button>
        </div>
      </motion.div>

      <div className="glass-panel">
        <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Key size={20} color="var(--text-muted)" /> Developer Security
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          Row Level Security (RLS) restricts database access exclusively to members carrying your Household ID. 
          Unauthenticated users and strangers are algorithmically banned from reading or writing to your ledger.
        </p>
      </div>

    </div>
  );
}
