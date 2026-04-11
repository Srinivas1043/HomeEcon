import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Hexagon, Loader2 } from 'lucide-react';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [message, setMessage] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        
        if (data?.user) {
          let assignedHouseholdId = data.user.id;
          
          if (inviteCode) {
            // Find the host profile matching the invite code
            const { data: hostProfile } = await supabase
              .from('profiles')
              .select('household_id')
              .eq('invite_code', inviteCode.toUpperCase())
              .single();
              
            if (hostProfile) assignedHouseholdId = hostProfile.household_id;
          }

          // Bootstrap their profile
          await supabase.from('profiles').upsert({ 
            id: data.user.id, 
            household_id: assignedHouseholdId,
            invite_code: Math.random().toString(36).substring(2, 8).toUpperCase()
          });
        }
        
        setMessage('Check your email for the login link!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px', color: 'var(--accent-primary)' }}>
          <Hexagon size={48} />
        </div>
        <h1 style={{ marginBottom: '8px' }}>Welcome to HomeEcon</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
          Real-time household finance & tracking
        </p>

        <form onSubmit={handleAuth}>
          <input
            type="email"
            placeholder="Email address"
            className="input-field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="input-field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {isSignUp && (
            <input
              type="text"
              placeholder="Invite Code (Optional)"
              className="input-field"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
            />
          )}
          
          <button 
            type="submit" 
            className="btn" 
            style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : (isSignUp ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        {message && (
          <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', color: 'var(--accent-primary)' }}>
             {message}
          </div>
        )}

        <div style={{ marginTop: '24px', color: 'var(--text-muted)' }}>
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}
          <button 
            onClick={() => setIsSignUp(!isSignUp)}
            style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', marginLeft: '8px', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </div>
      </div>
    </div>
  );
}
