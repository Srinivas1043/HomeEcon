import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Utensils, CalendarDays, ShoppingBag, Plus, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { getApiUrl } from '../lib/api';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function Grocery() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'planner' | 'meals'>('planner');
  
  const [newMealName, setNewMealName] = useState('');
  const [newIngredients, setNewIngredients] = useState('');

  // Fetch Meals
  const { data: meals } = useQuery({
    queryKey: ['meals'],
    queryFn: async () => {
      const { data, error } = await supabase.from('meals').select('*');
      if (error && error.code !== '42P01') throw error; // Ignore if table doesn't exist yet
      return data || [];
    }
  });

  // Fetch Meal Plans
  const { data: plans } = useQuery({
    queryKey: ['meal_plans'],
    queryFn: async () => {
      const { data, error } = await supabase.from('meal_plans').select('*, meals(*)');
      if (error && error.code !== '42P01') throw error; 
      return data || [];
    }
  });

  const addMealMutation = useMutation({
    mutationFn: async () => {
      const ingredientArray = newIngredients.split(',').map(i => i.trim()).filter(Boolean);
      const { error } = await supabase.from('meals').insert([{ title: newMealName, ingredients: ingredientArray }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals'] });
      setNewMealName('');
      setNewIngredients('');
    }
  });

  const deleteMealMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('meals').delete().eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals'] });
      queryClient.invalidateQueries({ queryKey: ['meal_plans'] });
    }
  });

  const assignMealMutation = useMutation({
    mutationFn: async ({ day, mealId }: { day: string, mealId: string }) => {
      const existing = plans?.find((p: any) => p.day_of_week === day);
      if (existing) {
         if (existing.meal_id === mealId) {
             await supabase.from('meal_plans').delete().eq('id', existing.id);
         } else {
             await supabase.from('meal_plans').update({ meal_id: mealId }).eq('id', existing.id);
         }
      } else {
         await supabase.from('meal_plans').insert([{ day_of_week: day, meal_id: mealId }]);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meal_plans'] })
  });

  // AI Logic
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aisleGroups, setAisleGroups] = useState<Record<string, string[]> | null>(null);

  const aiGenerateIngredients = async () => {
    if (!newMealName) return;
    setIsAiLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/v1/ai/ingredients'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newMealName })
      });
      const data = await res.json();
      setNewIngredients(data.join(', '));
    } catch (err) {
      alert("AI Assistant failed. Please enter ingredients manually.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const aiSortShoppingList = async (items: string[]) => {
    if (!items.length) return;
    setIsAiLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/v1/ai/shopping_list/sort'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      });
      const data = await res.json();
      setAisleGroups(data);
    } catch (err) {
      alert("AI Sorting failed.");
    } finally {
      setIsAiLoading(false);
    }
  };

  // Compile Grocery List
  const groceryList = Array.from(new Set(
    plans?.flatMap((p: any) => p.meals?.ingredients || [])
  )) as string[];

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <button 
          onClick={() => setActiveTab('planner')}
          className={activeTab === 'planner' ? 'btn' : 'btn btn-outline'}
          style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
        >
          <CalendarDays size={18} /> Weekly Planner
        </button>
        <button 
          onClick={() => setActiveTab('meals')}
          className={activeTab === 'meals' ? 'btn' : 'btn btn-outline'}
          style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
        >
          <Utensils size={18} /> Meal Library
        </button>
      </div>

      {activeTab === 'meals' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="glass-panel" style={{ marginBottom: '24px' }}>
            <h3 style={{ marginBottom: '16px' }}>Create New Meal</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input 
                placeholder="Meal Name (e.g. Chicken Caesar Wrap)" 
                value={newMealName} 
                onChange={e => setNewMealName(e.target.value)} 
                className="input-field" 
                style={{ marginBottom: 0 }}
              />
              <div style={{ position: 'relative' }}>
                <textarea 
                  placeholder="Ingredients (Comma separated: Chicken, Spinach, Cheese)" 
                  value={newIngredients} 
                  onChange={e => setNewIngredients(e.target.value)} 
                  className="input-field" 
                  style={{ marginBottom: 0, minHeight: '80px', paddingTop: '12px' }}
                />
                <button 
                  type="button"
                  onClick={aiGenerateIngredients}
                  disabled={!newMealName || isAiLoading}
                  className="btn btn-outline"
                  style={{ 
                    position: 'absolute', 
                    top: '8px', 
                    right: '8px', 
                    padding: '4px 12px', 
                    fontSize: '12px',
                    backgroundColor: 'rgba(255,255,255,0.05)'
                  }}
                >
                  {isAiLoading ? 'Searching...' : '✨ AI Assist'}
                </button>
              </div>
              <button 
                className="btn" 
                onClick={() => addMealMutation.mutate()} 
                disabled={!newMealName || addMealMutation.isPending}
                style={{ alignSelf: 'flex-start' }}
              >
                <Plus size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
                Save Meal
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
            {meals?.map((meal: any) => (
              <div key={meal.id} className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ fontWeight: 600, fontSize: '16px', marginBottom: '8px', color: 'var(--accent-cyan)' }}>{meal.title}</h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    {meal.ingredients.join(', ')}
                  </p>
                </div>
                <button 
                  onClick={() => deleteMealMutation.mutate(meal.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--danger)', alignSelf: 'flex-end', marginTop: '16px', cursor: 'pointer' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {activeTab === 'planner' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          
          <div className="glass-panel">
            <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', fontWeight: 600 }}>
               <CalendarDays size={20} color="var(--accent-primary)" /> Weekly Schedule
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {DAYS.map(day => {
                 const plan = plans?.find((p: any) => p.day_of_week === day);
                 return (
                   <div key={day} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
                     <span style={{ fontWeight: 600, width: '100px', color: 'var(--text-muted)' }}>{day}</span>
                     <select 
                       className="input-field" 
                       style={{ flex: 1, marginBottom: 0, padding: '8px 12px', background: 'transparent' }}
                       value={plan?.meal_id || ''}
                       onChange={(e) => assignMealMutation.mutate({ day, mealId: e.target.value })}
                     >
                       <option value="">-- No Meal Planned --</option>
                       {meals?.map((m: any) => (
                         <option key={m.id} value={m.id}>{m.title}</option>
                       ))}
                     </select>
                   </div>
                 )
              })}
            </div>
          </div>

          <div className="glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', fontWeight: 600 }}>
                 <ShoppingBag size={20} color="var(--success)" /> Grocery List
              </h3>
              {groceryList.length > 0 && (
                <button 
                  className="btn btn-outline" 
                  style={{ fontSize: '12px', padding: '4px 12px' }}
                  onClick={() => aiSortShoppingList(groceryList)}
                  disabled={isAiLoading}
                >
                  {isAiLoading ? 'Sorting...' : '✨ Organise by Aisle'}
                </button>
              )}
            </div>

            {aisleGroups ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {Object.entries(aisleGroups).map(([category, items]) => (
                  <div key={category}>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-primary)', marginBottom: '8px', fontWeight: 700 }}>
                      {category}
                    </div>
                    {items.map((item, idx) => (
                      <div key={idx} style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', fontSize: '14px', marginBottom: '4px' }}>
                        {item}
                      </div>
                    ))}
                  </div>
                ))}
                <button className="btn btn-outline" style={{ fontSize: '12px', marginTop: '12px' }} onClick={() => setAisleGroups(null)}>
                  Reset to Simple List
                </button>
              </div>
            ) : groceryList.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '20px' }}>
                Plan some meals to automatically generate your shopping list.
              </p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {groceryList.map((item: any, i: number) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                    <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: '2px solid var(--success)' }} />
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          
        </motion.div>
      )}

    </div>
  );
}
