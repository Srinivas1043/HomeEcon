import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area, Legend, LineChart, Line
} from 'recharts';
import { Activity, Wallet, ArrowUpRight, ArrowDownRight, Sparkles, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getApiUrl } from '../lib/api';

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#00C49F', '#FF8042', '#0088FE', '#FFBB28'];

export default function Dashboard() {
  // 1. Fetch Transactions
  const { data: transactions } = useQuery({
    queryKey: ['dashboard_transactions'],
    queryFn: async () => {
      const { data } = await supabase
        .from('transactions')
        .select('*, categories(name)')
        .order('date', { ascending: true });
      return data || [];
    }
  });

  // 2. Fetch Accounts
  const { data: accounts } = useQuery({
    queryKey: ['dashboard_accounts'],
    queryFn: async () => {
      const { data } = await supabase.from('accounts').select('*');
      return data || [];
    }
  });

  // 3. AI Forecast
  const { data: forecast } = useQuery({
    queryKey: ['financial_forecast', transactions?.length, accounts?.length],
    queryFn: async () => {
      if (!transactions?.length || !accounts?.length) return null;
      const res = await fetch(getApiUrl('/api/v1/ai/forecast'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions: transactions.map((tx: any) => ({ date: tx.date, amount: tx.amount, title: tx.title })),
          current_balances: accounts
        })
      });
      if (!res.ok) throw new Error('Forecast failed');
      return res.json();
    },
    enabled: !!transactions?.length && !!accounts?.length
  });

  const [showFortune, setShowFortune] = useState(false);

  // Data Processing
  const totalBalance = accounts?.reduce((sum: number, acc: any) => sum + (acc.balance || 0), 0) || 0;
  
  const monthlyData = transactions?.reduce((acc: any[], tx: any) => {
    const month = new Date(tx.date).toLocaleDateString('default', { month: 'short' });
    const existing = acc.find(d => d.name === month);
    if (existing) {
      if (tx.type === 'INCOME') existing.income += tx.amount;
      else existing.expenses += Math.abs(tx.amount);
    } else {
      acc.push({ 
        name: month, 
        income: tx.type === 'INCOME' ? tx.amount : 0, 
        expenses: tx.type === 'EXPENSE' ? Math.abs(tx.amount) : 0 
      });
    }
    return acc;
  }, []) || [];

  const categoryData = transactions?.filter((tx: any) => tx.type === 'EXPENSE').reduce((acc: any[], tx: any) => {
    const catName = tx.categories?.name || tx.metadata?.original_category || 'Uncategorized';
    const existing = acc.find(d => d.name === catName);
    if (existing) {
      existing.value += Math.abs(tx.amount);
    } else {
      acc.push({ name: catName, value: Math.abs(tx.amount) });
    }
    return acc;
  }, []) || [];

  return (
    <div style={{ paddingBottom: '40px' }}>
      <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '28px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Activity color="var(--accent-primary)" /> Financial Pulse
          </h2>
          <p style={{ color: 'var(--text-muted)' }}>Real-time analytics across all your wallets and households.</p>
        </div>
        <button 
          className="btn" 
          onClick={() => setShowFortune(!showFortune)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--accent-primary)' }}
        >
          <Sparkles size={18} /> {showFortune ? 'Hide Fortune' : 'Tell my Fortune'}
        </button>
      </header>

      <AnimatePresence>
        {showFortune && forecast && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} 
            animate={{ opacity: 1, height: 'auto' }} 
            exit={{ opacity: 0, height: 0 }}
            className="glass-panel" 
            style={{ marginBottom: '32px', overflow: 'hidden', border: '2px solid var(--accent-primary)' }}
          >
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles color="var(--accent-primary)" /> AI Financial Forecast
                  </h3>
                  <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
                    Prediction for the next 30 days based on your unique spending DNA.
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Confidence</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent-cyan)' }}>{Math.round(forecast.confidence_score * 100)}%</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
                <div style={{ height: '240px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={forecast.daily_projections}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis 
                        dataKey="date" 
                        stroke="var(--text-muted)" 
                        fontSize={10}
                        tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                      />
                      <YAxis stroke="var(--text-muted)" fontSize={10} domain={['auto', 'auto']} />
                      <Tooltip 
                        labelFormatter={(val) => new Date(val).toLocaleDateString(undefined, { dateStyle: 'long' })}
                        contentStyle={{ background: 'rgba(0,0,0,0.8)', border: '1px solid var(--glass-border)', borderRadius: '12px' }}
                      />
                      <Line type="monotone" dataKey="balance" stroke="var(--accent-primary)" strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                   {forecast.insights.map((insight: string, idx: number) => (
                     <div key={idx} style={{ display: 'flex', gap: '12px', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px', fontSize: '14px' }}>
                        <AlertCircle size={18} color="var(--accent-cyan)" style={{ flexShrink: 0 }} />
                        <span>{insight}</span>
                     </div>
                   ))}
                   <div style={{ marginTop: 'auto', padding: '12px', borderRadius: '12px', background: forecast.risk_level === 'Low' ? 'rgba(74, 222, 128, 0.1)' : 'rgba(239, 68, 68, 0.1)', border: '1px solid currentColor', fontSize: '14px' }}>
                      <span style={{ fontWeight: 600 }}>Risk Level: </span> {forecast.risk_level}
                   </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        <StatCard 
          title="Total Net Worth" 
          value={`€${totalBalance.toLocaleString()}`} 
          icon={<Wallet color="var(--accent-cyan)" />} 
          trend="+12% this month"
        />
        <StatCard 
          title="Monthly Income" 
          value={`€${monthlyData?.at(-1)?.income.toLocaleString() || 0}`} 
          icon={<ArrowUpRight color="var(--success)" />} 
        />
        <StatCard 
          title="Monthly Expenses" 
          value={`€${monthlyData?.at(-1)?.expenses.toLocaleString() || 0}`} 
          icon={<ArrowDownRight color="var(--danger)" />} 
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ marginBottom: '24px', fontSize: '18px', fontWeight: 600 }}>Cash Flow Trend</h3>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--success)" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="var(--success)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" stroke="var(--text-muted)" />
                <YAxis stroke="var(--text-muted)" />
                <Tooltip contentStyle={{ background: 'rgba(0,0,0,0.8)', border: '1px solid var(--glass-border)', borderRadius: '12px' }} />
                <Area type="monotone" dataKey="income" stroke="var(--success)" fillOpacity={1} fill="url(#colorIncome)" />
                <Area type="monotone" dataKey="expenses" stroke="var(--danger)" fillOpacity={0} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ marginBottom: '24px', fontSize: '18px', fontWeight: 600 }}>Spending by Category</h3>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value"
                >
                  {categoryData?.map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '24px', marginTop: '24px' }}>
        <h3 style={{ marginBottom: '24px', fontSize: '18px', fontWeight: 600 }}>Weekly Spending Patterns</h3>
        <div style={{ height: '300px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" stroke="var(--text-muted)" />
              <YAxis stroke="var(--text-muted)" />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} contentStyle={{ background: 'rgba(0,0,0,0.8)', border: '1px solid var(--glass-border)', borderRadius: '12px' }} />
              <Bar dataKey="expenses" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, trend }: { title: string, value: string, icon: React.ReactNode, trend?: string }) {
  return (
    <motion.div 
      whileHover={{ y: -4 }}
      className="glass-panel" 
      style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
    >
      <div>
        <div style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '8px' }}>{title}</div>
        <div style={{ fontSize: '24px', fontWeight: 700, marginBottom: trend ? '8px' : 0 }}>{value}</div>
        {trend && <div style={{ fontSize: '12px', color: 'var(--success)' }}>{trend}</div>}
      </div>
      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '12px' }}>
        {icon}
      </div>
    </motion.div>
  );
}
