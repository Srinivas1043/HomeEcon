import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Plus, Activity, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Trackers() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  
  // Custom Trackers
  const [trackerName, setTrackerName] = useState('Workout');
  const [trackerValue, setTrackerValue] = useState('');
  const [trackerUnit, setTrackerUnit] = useState('mins');

  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    }
  });

  const { data: trackings, isLoading } = useQuery({
    queryKey: ['trackings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('type', 'TRACKER')
        .order('date', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const addTrackingMutation = useMutation({
    mutationFn: async (newT: any) => {
      const { data, error } = await supabase.from('transactions').insert([newT]);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trackings'] });
      setShowForm(false);
      setTrackerValue('');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id) return;
    
    // Storing tracking logs in transactions using type TRACKER and JSON metadata
    addTrackingMutation.mutate({
      user_id: session.user.id,
      title: trackerName,
      type: 'TRACKER',
      amount: 0,
      metadata: { 
        value: trackerValue, 
        unit: trackerUnit,
        isTracker: true
      }
    });
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 600 }}>Personal Life Trackers</h2>
        <button className="btn" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setShowForm(!showForm)}>
          <Plus size={18} /> Log Metric
        </button>
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="glass-panel" style={{ marginBottom: '24px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <input required placeholder="Tracker Category (e.g., Workout, Reading, Sleep)" value={trackerName} onChange={(e) => setTrackerName(e.target.value)} className="input-field" />
            </div>
            <input required placeholder="Value (e.g., 45, true, completed)" value={trackerValue} onChange={(e) => setTrackerValue(e.target.value)} className="input-field" />
            <input placeholder="Unit (mins, pages, hours)" value={trackerUnit} onChange={(e) => setTrackerUnit(e.target.value)} className="input-field" />
            
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn" disabled={addTrackingMutation.isPending}>
                {addTrackingMutation.isPending ? 'Saving...' : 'Save Log'}
              </button>
            </div>
          </form>
        </motion.div>
      )}

      <div className="glass-panel" style={{ minHeight: '400px' }}>
        {isLoading ? (
          <div>Loading trackers...</div>
        ) : trackings?.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>No metrics recorded. Start tracking your life!</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {trackings?.map((log: any) => (
              <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid var(--glass-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Activity size={24} color="var(--accent-primary)" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 500 }}>{log.title}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {new Date(log.date).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '20px' }}>
                    {log.metadata?.value} <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 400 }}>{log.metadata?.unit}</span>
                  </div>
                  {log.metadata?.value === 'Completed' || log.metadata?.value === 'true' && (
                    <CheckCircle size={16} color="var(--success)" style={{ marginTop: '4px' }} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
