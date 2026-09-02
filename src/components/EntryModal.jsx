import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toIsoLocal } from '../utils/dates';

const BASE_CURRENCIES = ['EUR', 'USD', 'GBP', 'JPY'];
const TYPES = ['Cash', 'Card', 'Wire', 'Other'];

export default function EntryModal({ userId, householdId, categories, customCurrencies, existing, onClose, onSaved }) {
  const [form, setForm] = useState(() => existing ? {
    entry_date: existing.entry_date,
    amount: existing.amount,
    direction: existing.direction,
    currency_code: existing.currency_code,
    fx_rate_to_eur: existing.fx_rate_to_eur,
    type: existing.type,
    type_other_description: existing.type_other_description || '',
    category_id: existing.category_id || '',
    note: existing.note || '',
    visibility: existing.visibility,
  } : {
    entry_date: toIsoLocal(new Date()),
    amount: '',
    direction: 'outflow',
    currency_code: 'EUR',
    fx_rate_to_eur: 1,
    type: 'Card',
    type_other_description: '',
    category_id: categories[0]?.id || '',
    note: '',
    visibility: 'private',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const allCurrencies = [...BASE_CURRENCIES, ...customCurrencies.map((c) => c.code)];
  const selectedCategory = categories.find((c) => c.id === form.category_id);

  useEffect(() => {
    if (form.currency_code === 'EUR') setForm((f) => ({ ...f, fx_rate_to_eur: 1 }));
  }, [form.currency_code]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);

    if (!form.category_id) { setError('Choose a category.'); return; }
    if (!form.amount || Number(form.amount) <= 0) { setError('Amount must be a positive number.'); return; }
    if (form.currency_code !== 'EUR' && (!form.fx_rate_to_eur || Number(form.fx_rate_to_eur) <= 0)) {
      setError('Enter the spot rate to EUR for this transaction.');
      return;
    }
    if (form.type === 'Other' && !form.type_other_description.trim()) {
      setError('Describe the "Other" payment type.');
      return;
    }
    if (form.visibility === 'household' && !householdId) {
      setError('You need to join or create a household before sharing an entry with one.');
      return;
    }

    setSaving(true);
    const amount = Number(form.amount);
    const fx = Number(form.fx_rate_to_eur) || 1;
    const payload = {
      user_id: userId,
      entry_date: form.entry_date,
      amount,
      direction: form.direction,
      currency_code: form.currency_code,
      fx_rate_to_eur: fx,
      amount_eur: Math.round(amount * fx * 100) / 100,
      type: form.type,
      type_other_description: form.type === 'Other' ? form.type_other_description.trim() : null,
      category_id: form.category_id,
      // Snapshot, not a live FK lookup - see schema.sql for why.
      subcategory_snapshot: selectedCategory?.subcategory,
      note: form.note.trim() || null,
      visibility: form.visibility,
      // Recomputed from the current form state every save, whether
      // creating a new entry or editing one - this is what makes
      // switching an entry between private <-> household work correctly,
      // in either direction, at edit time.
      household_id: form.visibility === 'household' ? householdId : null,
    };

    let err;
    if (existing) {
      ({ error: err } = await supabase.from('transactions').update(payload).eq('id', existing.id));
    } else {
      ({ error: err } = await supabase.from('transactions').insert(payload));
    }
    setSaving(false);
    if (err) { setError(err.message); return; }
    onSaved();
  }

  async function remove() {
    if (!existing) return;
    if (!confirm('Delete this entry? This cannot be undone.')) return;
    setSaving(true);
    const { error: err } = await supabase.from('transactions').delete().eq('id', existing.id);
    setSaving(false);
    if (err) { setError(err.message); return; }
    onSaved();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3 style={{ marginBottom: 18 }}>{existing ? 'Edit entry' : 'Add entry'}</h3>

        <div className="field-row">
          <div className="field">
            <label>Date</label>
            <input type="date" value={form.entry_date} onChange={(e) => update('entry_date', e.target.value)} required />
          </div>
          <div className="field">
            <label>Direction</label>
            <select value={form.direction} onChange={(e) => update('direction', e.target.value)}>
              <option value="inflow">Inflow (income)</option>
              <option value="outflow">Outflow (expense)</option>
            </select>
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label>Amount</label>
            <input type="number" step="0.01" min="0.01" value={form.amount} onChange={(e) => update('amount', e.target.value)} required />
          </div>
          <div className="field">
            <label>Currency</label>
            <select value={form.currency_code} onChange={(e) => update('currency_code', e.target.value)}>
              {allCurrencies.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {form.currency_code !== 'EUR' && (
          <div className="field">
            <label>Spot rate to EUR (1 {form.currency_code} = ? EUR)</label>
            <input type="number" step="0.0001" min="0.0001" value={form.fx_rate_to_eur} onChange={(e) => update('fx_rate_to_eur', e.target.value)} required />
          </div>
        )}

        <div className="field-row">
          <div className="field">
            <label>Type</label>
            <select value={form.type} onChange={(e) => update('type', e.target.value)}>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Visibility</label>
            <select value={form.visibility} onChange={(e) => update('visibility', e.target.value)}>
              <option value="private">Private</option>
              {householdId && <option value="household">Household</option>}
            </select>
          </div>
        </div>

        {form.type === 'Other' && (
          <div className="field">
            <label>Describe payment type</label>
            <input value={form.type_other_description} onChange={(e) => update('type_other_description', e.target.value)} required />
          </div>
        )}

        <div className="field">
          <label>Category</label>
          <select value={form.category_id} onChange={(e) => update('category_id', e.target.value)} required>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {selectedCategory && (
          <span className={`tag ${selectedCategory.subcategory.toLowerCase()}`}>{selectedCategory.subcategory}</span>
        )}

        <div className="field" style={{ marginTop: 14 }}>
          <label>Note (optional)</label>
          <textarea value={form.note} onChange={(e) => update('note', e.target.value)} />
        </div>

        {error && <div className="warning-banner">{error}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1 }}>
            {saving ? 'Saving…' : 'Save entry'}
          </button>
          {existing && (
            <button type="button" className="btn btn-danger" onClick={remove} disabled={saving}>Delete</button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
