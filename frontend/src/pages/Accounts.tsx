import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Plus, Wallet } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Accounts() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [type, setType] = useState('BANK_ACCOUNT');
  const [editId, setEditId] = useState<string | null>(null);

  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    }
  });

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data;
    }
  });

  const addAccountMutation = useMutation({
    mutationFn: async (newAcc: any) => {
      let result;
      if (editId) {
        result = await supabase.from('accounts').update(newAcc).eq('id', editId).select();
      } else {
        result = await supabase.from('accounts').insert([newAcc]).select();
      }
      if (result.error) throw result.error;
      return result.data;
    },
    onError: (err: any) => alert(`Error saving account: ${err.message}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setShowForm(false);
      setEditId(null);
      setName(''); setBalance('');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id) return;
    
    // Create the account. household_id would be tied in a production env, 
    // for now we link it via auth RLS or just let it be generic to the logged in user via tracking metadata if needed, 
    // but the schema says household_id. We've bypassed strict household_id by making it nullable for now.
    addAccountMutation.mutate({
      name,
      balance: parseFloat(balance || '0'),
      type
    });
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 600 }}>Wallets & Accounts</h2>
        <button className="btn" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => { setEditId(null); setName(''); setBalance(''); setShowForm(!showForm); }}>
          <Plus size={18} /> New Wallet
        </button>
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="glass-panel" style={{ marginBottom: '24px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <input required placeholder="Wallet Name (e.g., Chase Checkings, Emergency Cash)" value={name} onChange={(e) => setName(e.target.value)} className="input-field" />
            </div>
            <input required type="number" step="0.01" placeholder="Current Balance (€)" value={balance} onChange={(e) => setBalance(e.target.value)} className="input-field" />
            <select className="input-field" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="BANK_ACCOUNT">Bank Account</option>
              <option value="CASH">Physical Cash</option>
              <option value="CREDIT">Credit Card</option>
              <option value="SAVINGS">Savings Account</option>
            </select>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" className="btn btn-outline" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</button>
              <button type="submit" className="btn" disabled={addAccountMutation.isPending}>
                {addAccountMutation.isPending ? 'Saving...' : (editId ? 'Update Wallet' : 'Save Wallet')}
              </button>
            </div>
          </form>
        </motion.div>
      )}

      <div className="glass-panel" style={{ minHeight: '400px' }}>
        {isLoading ? (
          <div>Loading accounts...</div>
        ) : accounts?.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>No wallets active. Add your current balance!</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            {accounts?.map((acc: any) => (
              <div key={acc.id} style={{ padding: '20px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Wallet size={24} color="var(--accent-primary)" />
                    <div style={{ fontWeight: 600 }}>{acc.name}</div>
                  </div>
                  <button 
                    onClick={() => { setEditId(acc.id); setName(acc.name); setBalance(acc.balance.toString()); setType(acc.type); setShowForm(true); }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px' }}
                  >
                    Edit
                  </button>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 700 }}>
                  €{acc.balance.toFixed(2)}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', textTransform: 'capitalize' }}>
                  {acc.type.replace('_', ' ')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
