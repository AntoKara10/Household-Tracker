import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext.jsx';
import EntryModal from '../components/EntryModal.jsx';
import { exportToCsv } from '../utils/csv';

export default function Entries() {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customCurrencies, setCustomCurrencies] = useState([]);
  const [editing, setEditing] = useState(null); // null | 'new' | entry object
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: tx }, { data: cats }, { data: curr }] = await Promise.all([
      supabase.from('transactions').select('*, categories(name)').eq('user_id', user.id).order('entry_date', { ascending: false }),
      supabase.from('categories').select('*').eq('user_id', user.id).order('name'),
      supabase.from('custom_currencies').select('*').eq('user_id', user.id),
    ]);
    setEntries(tx || []);
    setCategories(cats || []);
    setCustomCurrencies(curr || []);
    setLoading(false);
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  function handleExport() {
    exportToCsv('flowtrack-entries.csv', entries.map((e) => ({
      date: e.entry_date,
      direction: e.direction,
      amount: e.amount,
      currency: e.currency_code,
      fx_rate_to_eur: e.fx_rate_to_eur,
      amount_eur: e.amount_eur,
      type: e.type,
      type_other_description: e.type_other_description,
      category: e.categories?.name,
      subcategory: e.subcategory_snapshot,
      note: e.note,
      visibility: e.visibility,
    })));
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h2>Entries</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={handleExport}>Export CSV</button>
          <button className="btn btn-primary" onClick={() => setEditing('new')}>Add entry</button>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-dim)' }}>Loading…</p>
      ) : entries.length === 0 ? (
        <div className="card">
          <p style={{ color: 'var(--text-dim)', margin: 0 }}>No entries yet. Add your first one to see it here.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Category</th><th>Type</th><th>Amount</th><th>EUR</th><th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} onClick={() => setEditing(e)} style={{ cursor: 'pointer' }}>
                  <td className="mono">{e.entry_date}</td>
                  <td>
                    {e.categories?.name || '—'}{' '}
                    <span className={`tag ${e.subcategory_snapshot?.toLowerCase()}`}>{e.subcategory_snapshot}</span>
                  </td>
                  <td>{e.type}{e.type === 'Other' ? ` (${e.type_other_description})` : ''}</td>
                  <td className="mono">{e.direction === 'outflow' ? '-' : '+'}{e.amount} {e.currency_code}</td>
                  <td className={`mono ${e.direction === 'outflow' ? 'negative' : 'positive'}`}>
                    {e.direction === 'outflow' ? '-' : '+'}€{e.amount_eur.toFixed(2)}
                  </td>
                  <td style={{ color: 'var(--text-dim)' }}>{e.visibility === 'household' ? 'Household' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <EntryModal
          userId={user.id}
          categories={categories}
          customCurrencies={customCurrencies}
          existing={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}
