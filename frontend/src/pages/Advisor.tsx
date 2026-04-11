import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Sparkles, Send, BrainCircuit } from 'lucide-react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

export default function Advisor() {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  // Read transactions for context context
  const { data: transactions } = useQuery({
    queryKey: ['advisor_transactions'],
    queryFn: async () => {
      const { data } = await supabase.from('transactions').select('amount, type, title, date, metadata').order('date', { ascending: false }).limit(60);
      return data || [];
    }
  });

  const { data: accounts } = useQuery({
    queryKey: ['advisor_accounts'],
    queryFn: async () => {
      const { data } = await supabase.from('accounts').select('name, balance');
      return data || [];
    }
  });

  const getAIAdvice = async () => {
    if (!prompt) return;
    setLoading(true);
    setResponse('');
    try {
      const res = await fetch('/api/v1/ai/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          transactions: transactions || [],
          accounts: accounts || []
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to get advice');
      }

      const json = await res.json();
      setResponse(json.reply || "Sorry, I could not compute an answer.");

    } catch (err: any) {
      setResponse(`**Error:** ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <BrainCircuit size={28} color="var(--accent-primary)" />
        <h2 style={{ fontSize: '24px', fontWeight: 600 }}>Smart Advisor</h2>
      </div>

      <div className="glass-panel" style={{ flex: 1, minHeight: '300px', marginBottom: '24px', overflowY: 'auto' }}>
        {!response && !loading && (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '60px' }}>
            <Sparkles size={40} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
            <p>I am your Free AI Financial Advisor. Ask me anything about your current budget, predictions, or how to save more money!</p>
          </div>
        )}

        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ color: 'var(--accent-cyan)', textAlign: 'center', marginTop: '60px' }}>
             Analyzing Ledger Data...
          </motion.div>
        )}

        {response && !loading && (
           <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ lineHeight: 1.6, fontSize: '15px' }}>
              <ReactMarkdown>{response}</ReactMarkdown>
           </motion.div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <input 
          className="input-field" 
          style={{ flex: 1, marginBottom: 0 }} 
          placeholder="E.g. Where am I overspending this month?"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && getAIAdvice()}
        />
        <button className="btn" onClick={getAIAdvice} disabled={loading || !prompt} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
           <Send size={18} /> Send
        </button>
      </div>
    </div>
  );
}
