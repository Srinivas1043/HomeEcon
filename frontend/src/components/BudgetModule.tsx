import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Target, Plus } from 'lucide-react';
import { motion } from 'framer-motion';

export default function BudgetModule({ session }: { actualTxs: any[], session: any }) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [budgetInputs, setBudgetInputs] = useState<Record<string, string>>({});
  const [newCatName, setNewCatName] = useState('');

  const { data: budgetData } = useQuery({
    queryKey: ['budget_prediction'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('type', 'PREDICTION')
        .order('date', { ascending: false })
        .limit(1);
      
      if (error) throw error;
      return data?.[0] || null;
    }
  });

  const currentBudget = budgetData?.metadata || { Overall: 0, Savings: 0, Food: 0, Rent: 0, Entertainment: 0 };

  const currentMonthStart = new Date();
  currentMonthStart.setDate(1);
  currentMonthStart.setHours(0,0,0,0);

  const { data: monthTxs } = useQuery({
    queryKey: ['month_expenses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .neq('type', 'TRACKER')
        .gte('date', currentMonthStart.toISOString());
      if (error) throw error;
      return data || [];
    }
  });

  const saveBudgetMutation = useMutation({
    mutationFn: async (newBudget: any) => {
      const payload = {
        user_id: session?.user?.id,
        title: 'Monthly Limit Predictions',
        type: 'PREDICTION',
        amount: 0,
        metadata: newBudget
      };

      if (budgetData?.id) {
        await supabase.from('transactions').update(payload).eq('id', budgetData.id);
      } else {
        await supabase.from('transactions').insert([payload]);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget_prediction'] });
      // Also invalidate transaction categories cache when they update budget categories
      queryClient.invalidateQueries({ queryKey: ['transactions'] }); 
      setIsEditing(false);
    }
  });

  const handleSave = () => {
    const finalNumbers: Record<string, number> = {};
    Object.entries(budgetInputs).forEach(([k, v]) => {
      finalNumbers[k] = parseFloat(v || '0');
    });
    saveBudgetMutation.mutate(finalNumbers);
  };

  const openEdit = () => {
    const defaultInputs: Record<string, string> = {};
    Object.entries(currentBudget).forEach(([k, v]) => {
      if (k !== 'original_category' && k !== 'description' && k !== 'necessity') {
          defaultInputs[k] = String(v);
      }
    });
    
    // Ensure Base Fields exist
    if (!defaultInputs['Overall']) defaultInputs['Overall'] = '0';
    if (!defaultInputs['Savings']) defaultInputs['Savings'] = '0';
    setBudgetInputs(defaultInputs);
    setIsEditing(true);
  };

  const addCustomCategory = () => {
    if (newCatName.trim() && !budgetInputs[newCatName.trim()]) {
      setBudgetInputs(prev => ({ ...prev, [newCatName.trim()]: '0' }));
      setNewCatName('');
    }
  };

  const categories = Object.keys(currentBudget).filter(k => k !== 'Overall' && k !== 'Savings' && k !== 'original_category' && k !== 'description' && k !== 'necessity');
  
  if (categories.length === 0) categories.push('Food', 'Rent');
  
  // Dynamic Actuals computation filters
  const expenseTxs = monthTxs?.filter((t: any) => t.type === 'EXPENSE') || [];
  const incomeTxs = monthTxs?.filter((t: any) => t.type === 'INCOME') || [];

  const actuals: Record<string, number> = {};
  actuals['Overall'] = expenseTxs.reduce((s: number, t: any) => s + Math.abs(t.amount), 0);
  actuals['Savings'] = incomeTxs.reduce((s: number, t: any) => s + t.amount, 0) - actuals['Overall'];
  
  categories.forEach(cat => {
    actuals[cat] = expenseTxs.filter((t: any) => t.metadata?.original_category === cat).reduce((s: number, t: any) => s + Math.abs(t.amount), 0);
  });

  return (
    <div className="glass-panel" style={{ marginTop: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Target size={20} color="var(--accent-primary)" />
          Budget Goal
        </h3>
        {!isEditing && (
          <button onClick={openEdit} className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '12px' }}>
            Set Targets
          </button>
        )}
      </div>

      {isEditing ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div style={{ padding: '16px', background: 'rgba(244, 63, 94, 0.1)', borderRadius: '12px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--danger)' }}>Overall Spend Max (€)</label>
              <input 
                type="number" step="1" className="input-field" 
                style={{ marginBottom: 0, padding: '8px 12px', marginTop: '8px' }}
                value={budgetInputs['Overall'] || ''}
                onChange={e => setBudgetInputs({ ...budgetInputs, 'Overall': e.target.value })}
              />
            </div>
            
            <div style={{ padding: '16px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--success)' }}>Monthly Savings Goal (€)</label>
              <input 
                type="number" step="1" className="input-field" 
                style={{ marginBottom: 0, padding: '8px 12px', marginTop: '8px' }}
                value={budgetInputs['Savings'] || ''}
                onChange={e => setBudgetInputs({ ...budgetInputs, 'Savings': e.target.value })}
              />
            </div>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px', fontWeight: 600 }}>Category Limits</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            {Object.keys(budgetInputs).filter(k => k !== 'Overall' && k !== 'Savings').map(cat => (
              <div key={cat}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{cat}</label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <input 
                    type="number" step="1" className="input-field" 
                    style={{ marginBottom: 0, padding: '8px 12px' }}
                    value={budgetInputs[cat]}
                    onChange={e => setBudgetInputs({ ...budgetInputs, [cat]: e.target.value })}
                  />
                  <button onClick={() => {
                        const newInputs = {...budgetInputs};
                        delete newInputs[cat];
                        setBudgetInputs(newInputs);
                  }} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0 8px' }}>✕</button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', alignItems: 'center' }}>
            <input 
              placeholder="E.g., Groceries, Pets, Car" 
              value={newCatName} 
              onChange={e => setNewCatName(e.target.value)}
              className="input-field" 
              style={{ flex: 1, marginBottom: 0, padding: '8px 12px' }}
            />
            <button onClick={addCustomCategory} className="btn" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Plus size={16} /> Add
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button onClick={() => setIsEditing(false)} className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '13px' }}>Cancel</button>
            <button onClick={handleSave} className="btn" style={{ padding: '6px 12px', fontSize: '13px' }}>Save Targets</button>
          </div>
        </motion.div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Savings Render */}
          {Number(currentBudget['Savings']) > 0 && (() => {
             const target = Number(currentBudget['Savings']);
             const actual = actuals['Savings'];
             // The logic is inverted for savings: Green means we hit the target!
             const percentage = Math.min((Math.max(actual, 0) / target) * 100, 100);
             const hitGoal = actual >= target;

             return (
              <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px', fontWeight: 600 }}>
                  <span>Monthly Savings Goal</span>
                  <span><span style={{ color: hitGoal ? 'var(--success)' : (actual < 0 ? 'var(--danger)' : 'var(--text-main)') }}>€{actual.toFixed(0)}</span> / €{target}</span>
                </div>
                <div style={{ height: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '5px', overflow: 'hidden' }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${percentage}%` }}
                    style={{ height: '100%', background: 'var(--success)', borderRadius: '4px' }} 
                  />
                </div>
              </div>
             )
          })()}

          {/* Overall Render */}
          {Number(currentBudget['Overall']) > 0 && (() => {
             const target = Number(currentBudget['Overall']);
             const actual = actuals['Overall'];
             const percentage = Math.min((actual / target) * 100, 100);
             const isOver = actual > target;

             return (
              <div style={{ background: 'rgba(59, 130, 246, 0.05)', padding: '16px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px', fontWeight: 600 }}>
                  <span>Overall Monthly Spend</span>
                  <span><span style={{ color: isOver ? 'var(--danger)' : 'var(--text-main)' }}>€{actual.toFixed(0)}</span> / €{target}</span>
                </div>
                <div style={{ height: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '5px', overflow: 'hidden' }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${percentage}%` }}
                    style={{ height: '100%', background: isOver ? 'var(--danger)' : 'var(--accent-primary)', borderRadius: '4px' }} 
                  />
                </div>
              </div>
             )
          })()}

          {/* Categories Render */}
          {categories.map(cat => {
            const target = Number(currentBudget[cat]) || 0;
            if (target === 0) return null;
            const actual = actuals[cat] || 0;
            const percentage = Math.min((actual / target) * 100, 100);
            const isOver = actual > target;

            return (
              <div key={cat} style={{ padding: '0 8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 500 }}>{cat}</span>
                  <span><span style={{ color: isOver ? 'var(--danger)' : 'var(--text-main)' }}>€{actual.toFixed(0)}</span> / €{target}</span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${percentage}%` }}
                    style={{ height: '100%', background: isOver ? 'var(--danger)' : 'var(--accent-primary)', borderRadius: '3px' }} 
                  />
                </div>
              </div>
            );
          })}
          
          {Object.keys(currentBudget).length === 0 || Object.values(currentBudget).every(v => Number(v) === 0) ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', padding: '12px' }}>
              No budget limits set. Tap "Set Targets" to configure!
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
