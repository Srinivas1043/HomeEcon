import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Plus, Receipt, Trash2, Edit2, Upload } from 'lucide-react';
import { motion } from 'framer-motion';
import * as XLSX from 'xlsx';

export default function Transactions() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  
  // Minimal form state
  const [editId, setEditId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Food');
  const [description, setDescription] = useState(''); 
  const [necessity, setNecessity] = useState('Need');
  const [accountId, setAccountId] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Heuristic for extracting a clean title from ABN AMRO description
  const extractTitleFromDescription = (desc: string) => {
    if (!desc) return 'Unknown';
    
    // Pattern 1: /NAME/Merchant Name
    const nameMatch = desc.match(/\/NAME\/([^/]+)/);
    if (nameMatch && nameMatch[1]) return nameMatch[1].trim();
    
    // Pattern 2: BEA, ... BKC*Merchant Name
    const bkcMatch = desc.match(/BKC\*([^,]+)/);
    if (bkcMatch && bkcMatch[1]) return bkcMatch[1].trim();

    // Pattern 3: Common SEPA markers
    const sepaMatch = desc.match(/\/TRTP\/[^/]+\/([^/]+)/);
    if (sepaMatch && sepaMatch[1]) return sepaMatch[1].trim();

    // Pattern 4: Google Pay / Apple Pay markers
    if (desc.includes('Google Pay')) {
        const parts = desc.split('  ').filter(p => p.trim() !== '');
        if (parts.length > 1) return parts[1].split(',')[0].trim();
    }

    // Fallback: Just take the first few words or the whole thing if short
    return desc.length > 30 ? desc.substring(0, 30) + '...' : desc;
  };

  // Heuristic for Need/Want (refactored for reuse)
  const getNecessityFromTitle = (t: string) => {
    const lowerT = t.toLowerCase();
    const needs = ['rent', 'electricity', 'water', 'internet', 'gas', 'transport', 'grocery', 'supermarket', 'medical', 'insurance', 'tax', 'mortgage', 'loan', 'ah ', 'albert heijn', 'jumbo', 'lidl', 'aldi', 'dirk'];
    const wants = ['steam', 'netflix', 'amazon', 'game', 'restaurant', 'cafe', 'bar', 'movie', 'concert', 'hobby', 'spotify', 'subscription', 'clothing', 'drink', 'dinner', 'lunch', 'mediamarkt', 'mediamart', 'bol.com'];
    
    if (needs.some(n => lowerT.includes(n))) return 'Need';
    if (wants.some(w => lowerT.includes(w))) return 'Want';
    return 'Uncategorized';
  };

  // Heuristic Auto-Detector for Need/Want based on Title
  useEffect(() => {
    if (!title) return;
    const nec = getNecessityFromTitle(title);
    if (nec !== 'Uncategorized') setNecessity(nec);
  }, [title]);

  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    }
  });

  const { data: accounts } = useQuery({
    queryKey: ['accounts_list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('accounts').select('id, name');
      if (error) throw error;
      if (data?.length > 0 && !accountId && !editId) {
          setAccountId(data[0].id);
      }
      return data;
    }
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories_list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').order('name');
      if (error) throw error;
      return data || [];
    }
  });

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

  // Map category names to IDs for easier insertion
  const categoryMap = categoriesData?.reduce((acc: any, cat: any) => {
    acc[cat.name.toLowerCase()] = cat.id;
    return acc;
  }, {});

  const dynamicCategories = categoriesData?.map(c => c.name) || ['Food', 'Rent', 'Entertainment', 'Transport', 'Utilities'];
  
  // Ensure the selected category exists in the default list
  if (!dynamicCategories.includes('Income')) dynamicCategories.push('Income');
  if (category && !dynamicCategories.includes(category)) {
      dynamicCategories.push(category);
  }

  const { data: transactions, isLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .neq('type', 'TRACKER')
        .order('date', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const resetForm = () => {
    setShowForm(false);
    setEditId(null);
    setAmount(''); setTitle(''); setDescription(''); setNecessity('Need');
  };

  const addTxMutation = useMutation({
    mutationFn: async (newTx: any) => {
      if (session?.user?.id) {
         await supabase.from('profiles').upsert({ id: session.user.id }, { onConflict: 'id' });
      }

      let result;
      if (editId) {
        result = await supabase.from('transactions').update(newTx).eq('id', editId).select();
      } else if (Array.isArray(newTx)) {
        result = await supabase.from('transactions').insert(newTx).select();
      } else {
        result = await supabase.from('transactions').insert([newTx]).select();
      }
      
      if (result.error) throw result.error;
      return result.data;
    },
    onError: (err: any) => alert(`Could not save: ${err.message}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      resetForm();
    }
  });

  const deleteTxMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onError: (err: any) => alert(`Could not delete: ${err.message}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transactions'] })
  });
  
  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      return true;
    },
    onError: (err: any) => alert(`Could not clear ledger: ${err.message}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts_list'] });
      alert("Ledger cleared successfully.");
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id) {
       alert("You must be logged in!");
       return;
    }
    
    addTxMutation.mutate({
      user_id: session.user.id,
      title,
      amount: parseFloat(amount) * (category === 'Income' ? 1 : -1),
      type: category === 'Income' ? 'INCOME' : 'EXPENSE',
      account_id: accountId || null,
      category_id: categoryMap?.[category.toLowerCase()] || null,
      metadata: { description, necessity, original_category: category }
    });
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session?.user?.id) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const data = new Uint8Array(event.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json: any[] = XLSX.utils.sheet_to_json(worksheet);

      const mappedTransactionsRaw = json.map(row => {
        const rawAmount = parseFloat(row.amount);
        const rawDesc = row.description || '';
        
        // Only include expenses (negative amounts)
        if (isNaN(rawAmount) || rawAmount >= 0) return null;

        return {
          rawAmount,
          rawDesc
        };
      }).filter(tx => tx !== null);

      if (mappedTransactionsRaw.length > 0) {
        if (confirm(`Import ${mappedTransactionsRaw.length} expenses? AI will now summarize them.`)) {
            try {
                // Call AI Backend for classification
                const aiResponse = await fetch('/api/v1/ai/classify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        items: mappedTransactionsRaw.map((tx: any) => ({ description: tx.rawDesc }))
                    })
                });
                
                if (!aiResponse.ok) throw new Error('AI Classification failed');
                const aiData = await aiResponse.json();

                const finalTransactions = mappedTransactionsRaw.map((raw: any, index: number) => {
                    const ai = aiData[index] || {};
                    return {
                        user_id: session.user.id,
                        title: ai.title || extractTitleFromDescription(raw.rawDesc),
                        amount: raw.rawAmount,
                        type: 'EXPENSE',
                        date: new Date().toISOString(),
                        account_id: accountId || null,
                        category_id: categoryMap?.[ai.category?.toLowerCase()] || null,
                        metadata: { 
                            description: raw.rawDesc, 
                            ai_summary: ai.summary || 'Summary not available',
                            necessity: ai.necessity || getNecessityFromTitle(ai.title || raw.rawDesc),
                            original_category: ai.category || 'Imported',
                            import_source: 'ABN AMRO XLS (AI Powered)'
                        }
                    };
                });

                addTxMutation.mutate(finalTransactions);
            } catch (err) {
                console.error(err);
                alert("AI processing failed, falling back to manual import.");
                // Fallback to manual if AI fails
                const fallbackTxs = mappedTransactionsRaw.map((raw: any) => ({
                    user_id: session.user.id,
                    title: extractTitleFromDescription(raw.rawDesc),
                    amount: raw.rawAmount,
                    type: 'EXPENSE',
                    date: new Date().toISOString(),
                    account_id: accountId || null,
                    metadata: { 
                        description: raw.rawDesc, 
                        necessity: getNecessityFromTitle(raw.rawDesc),
                        original_category: 'Imported',
                        import_source: 'ABN AMRO XLS'
                    }
                }));
                addTxMutation.mutate(fallbackTxs);
            }
        }
      } else {
        alert("No expenses found in the selected file.");
      }
    };
    reader.readAsArrayBuffer(file);
    // Clear input so same file can be selected again
    e.target.value = '';
  };

  const handleEditClick = (tx: any) => {
    setEditId(tx.id);
    setTitle(tx.title);
    setAmount(Math.abs(tx.amount).toString());
    setCategory(tx.type === 'INCOME' ? 'Income' : (tx.metadata?.original_category || 'Food'));
    setDescription(tx.metadata?.description || '');
    setNecessity(tx.metadata?.necessity || 'Need');
    setAccountId(tx.account_id || '');
    setShowForm(true);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 600 }}>Ledger & Expenses</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            accept=".xls,.xlsx" 
            onChange={handleFileImport} 
          />
          <button 
            className="btn btn-outline" 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)', borderColor: 'rgba(255, 100, 100, 0.2)' }} 
            onClick={() => {
              if (confirm('DANGER: This will delete ALL transactions and reset your wallet balances. Are you absolutely sure?')) {
                clearAllMutation.mutate();
              }
            }}
            disabled={clearAllMutation.isPending}
          >
            {clearAllMutation.isPending ? 'Clearing...' : 'Clear Ledger'}
          </button>
          <button 
            className="btn btn-outline" 
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={18} /> Import ABN XLS
          </button>
          <button 
            className="btn" 
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }} 
            onClick={() => { resetForm(); setShowForm(!showForm); }}
          >
            <Plus size={18} /> Add Entry
          </button>
        </div>
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="glass-panel" style={{ marginBottom: '24px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <input required placeholder="Title (e.g., Target, Supermarket, Salary)" value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <input required placeholder="Granular Invoice Description (What exactly did you buy?)" value={description} onChange={(e) => setDescription(e.target.value)} className="input-field" />
            </div>
            
            <input required type="number" step="0.01" placeholder="Amount (€)" value={amount} onChange={(e) => setAmount(e.target.value)} className="input-field" />
            <div style={{ display: 'flex', gap: '8px' }}>
              {!isCustomCategory ? (
                <select className="input-field" style={{ flex: 1 }} value={category} onChange={(e) => {
                   if (e.target.value === '__custom__') {
                      setIsCustomCategory(true);
                      setCategory('');
                   } else {
                      setCategory(e.target.value);
                   }
                }}>
                  <option value="" disabled>Select Category</option>
                  {dynamicCategories.map((cat: string) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value="__custom__" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+ Add Custom Auto-Category</option>
                </select>
              ) : (
                <>
                  <input required placeholder="Enter Custom Category..." value={category} onChange={(e) => setCategory(e.target.value)} className="input-field" style={{ flex: 1 }} />
                  <button type="button" onClick={() => { setIsCustomCategory(false); setCategory('Food'); }} className="btn btn-outline" style={{ padding: '0 12px', height: '48px', marginTop: '2px' }}>✕</button>
                </>
              )}
            </div>
            
            <div style={{ gridColumn: '1 / -1' }}>
              <select className="input-field" value={necessity} onChange={(e) => setNecessity(e.target.value)}>
                <option>Need</option>
                <option>Want</option>
                <option>Investment</option>
                <option>Uncategorized</option>
              </select>
            </div>
            
            <div style={{ gridColumn: '1 / -1' }}>
              <select className="input-field" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">-- No Source Wallet --</option>
                {accounts?.map((acc: any) => (
                   <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" className="btn btn-outline" onClick={resetForm}>Cancel</button>
              <button type="submit" className="btn" disabled={addTxMutation.isPending}>
                {addTxMutation.isPending ? 'Saving...' : (editId ? 'Update Transaction' : 'Save Transaction')}
              </button>
            </div>
          </form>
        </motion.div>
      )}

      <div className="glass-panel" style={{ minHeight: '400px' }}>
        {isLoading ? (
          <div>Loading transactions...</div>
        ) : transactions?.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>No transactions recorded yet. Add your first expense!</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {transactions?.map((tx: any) => (
              <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid var(--glass-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Receipt size={24} color="var(--text-muted)" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tx.title}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', gap: '8px', marginTop: '2px' }}>
                      <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>{tx.type}</span>
                      {tx.metadata?.necessity && (
                        <>
                          <span style={{ opacity: 0.5 }}>•</span>
                          <span style={{ color: 'var(--accent-primary)', fontWeight: 500 }}>{tx.metadata.necessity}</span>
                        </>
                      )}
                    </div>
                    {tx.metadata?.ai_summary ? (
                      <div style={{ 
                        fontSize: '13px', 
                        color: 'var(--text-main)', 
                        marginTop: '8px', 
                        fontWeight: 450,
                        lineHeight: '1.4',
                        background: 'rgba(255, 255, 255, 0.05)',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        borderLeft: '3px solid var(--accent-primary)'
                      }}>
                        {tx.metadata.ai_summary}
                      </div>
                    ) : tx.metadata?.description && (
                      <div style={{ 
                        fontSize: '12px', 
                        color: 'var(--text-muted)', 
                        marginTop: '6px', 
                        fontStyle: 'italic',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        lineHeight: '1.4',
                        opacity: 0.8
                      }}>
                        {tx.metadata.description}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px', marginLeft: '16px', minWidth: '100px' }}>
                  <div style={{ 
                    fontSize: '18px',
                    fontWeight: 700, 
                    color: tx.amount > 0 ? 'var(--success)' : 'var(--text-main)',
                    letterSpacing: '-0.02em',
                    background: tx.amount > 0 ? 'rgba(74, 222, 128, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                    padding: '4px 12px',
                    borderRadius: '8px',
                    whiteSpace: 'nowrap'
                  }}>
                    {tx.amount > 0 ? '+' : ''}€{Math.abs(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  
                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button 
                      onClick={() => handleEditClick(tx)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                      title="Edit"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this transaction?')) {
                          deleteTxMutation.mutate(tx.id);
                        }
                      }}
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '4px' }}
                      title="Delete"
                      disabled={deleteTxMutation.isPending}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
