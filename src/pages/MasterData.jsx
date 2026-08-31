import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext.jsx';
import { toIsoLocal } from '../utils/dates';

export default function MasterData() {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newCategory, setNewCategory] = useState({ name: '', subcategory: 'Operational' });
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingCategoryDraft, setEditingCategoryDraft] = useState({ name: '', subcategory: 'Operational' });
  const [newBudget, setNewBudget] = useState({ category_id: '', amount: '', effective_date: toIsoLocal(new Date()) });
  const [newCurrency, setNewCurrency] = useState({ code: '', name: '' });
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: cats }, { data: bgts }, { data: curr }] = await Promise.all([
      supabase.from('categories').select('*').eq('user_id', user.id).order('name'),
      supabase.from('budgets').select('*, categories(name)').eq('user_id', user.id).order('effective_date', { ascending: false }),
      supabase.from('custom_currencies').select('*').eq('user_id', user.id).order('code'),
    ]);
    setCategories(cats || []);
    setBudgets(bgts || []);
    setCurrencies(curr || []);
    setLoading(false);
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  async function addCategory(e) {
    e.preventDefault();
    setError(null);
    if (!newCategory.name.trim()) return;
    const { error: err } = await supabase.from('categories').insert({
      user_id: user.id, name: newCategory.name.trim(), subcategory: newCategory.subcategory,
    });
    if (err) { setError(err.message); return; }
    setNewCategory({ name: '', subcategory: 'Operational' });
    load();
  }

  async function deleteCategory(id) {
    if (!confirm('Delete this category? Existing entries keep their recorded subcategory, but new entries can no longer use it.')) return;
    await supabase.from('categories').delete().eq('id', id);
    load();
  }

  function startEditCategory(c) {
    setEditingCategoryId(c.id);
    setEditingCategoryDraft({ name: c.name, subcategory: c.subcategory });
  }

  function cancelEditCategory() {
    setEditingCategoryId(null);
  }

  async function saveEditCategory(id) {
    setError(null);
    if (!editingCategoryDraft.name.trim()) return;
    const { error: err } = await supabase.from('categories').update({
      name: editingCategoryDraft.name.trim(),
      subcategory: editingCategoryDraft.subcategory,
    }).eq('id', id);
    if (err) { setError(err.message); return; }
    // Note: this changes the category's classification going forward only.
    // Past transactions keep whatever classification they were saved with
    // (subcategory_snapshot), so historical Operational/Nonoperational
    // reporting on the dashboard is unaffected by this edit.
    setEditingCategoryId(null);
    load();
  }

  async function addBudget(e) {
    e.preventDefault();
    setError(null);
    if (!newBudget.category_id || !newBudget.amount) return;
    const { error: err } = await supabase.from('budgets').insert({
      user_id: user.id,
      category_id: newBudget.category_id,
      amount: Number(newBudget.amount),
      effective_date: newBudget.effective_date,
    });
    if (err) { setError(err.message); return; }
    setNewBudget({ category_id: '', amount: '', effective_date: toIsoLocal(new Date()) });
    load();
  }

  async function deleteBudget(id) {
    await supabase.from('budgets').delete().eq('id', id);
    load();
  }

  async function addCurrency(e) {
    e.preventDefault();
    setError(null);
    if (!newCurrency.code.trim() || !newCurrency.name.trim()) return;
    const { error: err } = await supabase.from('custom_currencies').insert({
      user_id: user.id, code: newCurrency.code.trim().toUpperCase(), name: newCurrency.name.trim(),
    });
    if (err) { setError(err.message); return; }
    setNewCurrency({ code: '', name: '' });
    load();
  }

  async function deleteCurrency(id) {
    await supabase.from('custom_currencies').delete().eq('id', id);
    load();
  }

  if (loading) return <p style={{ color: 'var(--text-dim)' }}>Loading…</p>;

  return (
    <div>
      <h2>Master data</h2>
      <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>
        Categories, budgets, and currencies here apply only to your own entries. Household totals combine these
        across members by matching category names (see Household page).
      </p>
      {error && <div className="warning-banner">{error}</div>}

      {/* ---- Categories ---- */}
      <div className="section-heading">Categories</div>
      <div className="card">
        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 0 }}>
          Set a category to "Unclassified" if you don't want it counted in the Operational/Nonoperational split at
          all (e.g. income you'd rather just see under the top summary). Editing a classification only applies
          going forward - past entries keep whatever classification they were saved with.
        </p>
        <table>
          <thead><tr><th>Name</th><th>Classification</th><th></th></tr></thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id}>
                {editingCategoryId === c.id ? (
                  <>
                    <td><input value={editingCategoryDraft.name} onChange={(e) => setEditingCategoryDraft((d) => ({ ...d, name: e.target.value }))} /></td>
                    <td>
                      <select value={editingCategoryDraft.subcategory} onChange={(e) => setEditingCategoryDraft((d) => ({ ...d, subcategory: e.target.value }))}>
                        <option value="Operational">Operational</option>
                        <option value="Nonoperational">Nonoperational</option>
                        <option value="Unclassified">Unclassified</option>
                      </select>
                    </td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => saveEditCategory(c.id)}>Save</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={cancelEditCategory}>Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{c.name}</td>
                    <td><span className={`tag ${c.subcategory.toLowerCase()}`}>{c.subcategory}</span></td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEditCategory(c)}>Edit</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => deleteCategory(c.id)}>Remove</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <form onSubmit={addCategory} className="field-row" style={{ marginTop: 16, alignItems: 'end' }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>New category name</label>
            <input value={newCategory.name} onChange={(e) => setNewCategory((n) => ({ ...n, name: e.target.value }))} placeholder="e.g. Pet care" />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Classification</label>
            <select value={newCategory.subcategory} onChange={(e) => setNewCategory((n) => ({ ...n, subcategory: e.target.value }))}>
              <option value="Operational">Operational</option>
              <option value="Nonoperational">Nonoperational</option>
              <option value="Unclassified">Unclassified</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary">Add</button>
        </form>
      </div>

      {/* ---- Budgets ---- */}
      <div className="section-heading">Budgets</div>
      <div className="card">
        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 0 }}>
          Each budget applies from its effective date forward. Changing a category's budget doesn't rewrite past months —
          add a new row with a new effective date instead.
        </p>
        <table>
          <thead><tr><th>Category</th><th>Amount</th><th>Effective from</th><th></th></tr></thead>
          <tbody>
            {budgets.map((b) => (
              <tr key={b.id}>
                <td>{b.categories?.name}</td>
                <td className="mono">€{Number(b.amount).toFixed(2)}</td>
                <td className="mono">{b.effective_date}</td>
                <td><button className="btn btn-ghost btn-sm" onClick={() => deleteBudget(b.id)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <form onSubmit={addBudget} className="field-row" style={{ marginTop: 16, alignItems: 'end', gridTemplateColumns: '1fr 1fr 1fr auto' }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Category</label>
            <select value={newBudget.category_id} onChange={(e) => setNewBudget((n) => ({ ...n, category_id: e.target.value }))}>
              <option value="">Select…</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Monthly amount (EUR)</label>
            <input type="number" step="0.01" min="0" value={newBudget.amount} onChange={(e) => setNewBudget((n) => ({ ...n, amount: e.target.value }))} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Effective from</label>
            <input type="date" value={newBudget.effective_date} onChange={(e) => setNewBudget((n) => ({ ...n, effective_date: e.target.value }))} />
          </div>
          <button type="submit" className="btn btn-primary">Add</button>
        </form>
      </div>

      {/* ---- Currencies ---- */}
      <div className="section-heading">Currencies</div>
      <div className="card">
        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 0 }}>
          EUR, USD, GBP, and JPY are always available. Add others here if you need them.
        </p>
        <table>
          <thead><tr><th>Code</th><th>Name</th><th></th></tr></thead>
          <tbody>
            {currencies.map((c) => (
              <tr key={c.id}>
                <td className="mono">{c.code}</td>
                <td>{c.name}</td>
                <td><button className="btn btn-ghost btn-sm" onClick={() => deleteCurrency(c.id)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <form onSubmit={addCurrency} className="field-row" style={{ marginTop: 16, alignItems: 'end' }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Code (e.g. CHF)</label>
            <input value={newCurrency.code} onChange={(e) => setNewCurrency((n) => ({ ...n, code: e.target.value }))} maxLength={6} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Name</label>
            <input value={newCurrency.name} onChange={(e) => setNewCurrency((n) => ({ ...n, name: e.target.value }))} placeholder="Swiss Franc" />
          </div>
          <button type="submit" className="btn btn-primary">Add</button>
        </form>
      </div>
    </div>
  );
}
