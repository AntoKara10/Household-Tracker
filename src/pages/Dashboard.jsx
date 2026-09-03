import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext.jsx';
import { periodRange, monthBuckets, MONTH_NAMES } from '../utils/dates';
import { resolveBudgetForMonth, totalBudgetOverBuckets, varianceStatus } from '../utils/budget';
import EntryModal from '../components/EntryModal.jsx';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

const CURRENT_YEAR = new Date().getFullYear();

export default function Dashboard() {
  const { user, profile } = useAuth();
  const [dash, setDash] = useState({ period: 'this_month', monthOffset: 0, yearSelect: CURRENT_YEAR, rangeStart: '', rangeEnd: '' });
  const [view, setView] = useState('mine'); // 'mine' | 'household'

  const [categories, setCategories] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [customCurrencies, setCustomCurrencies] = useState([]);
  const [householdMembers, setHouseholdMembers] = useState([]);
  const [drillCategory, setDrillCategory] = useState(null);
  const [addingEntry, setAddingEntry] = useState(false);
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => periodRange(dash), [dash]);
  const buckets = useMemo(() => monthBuckets(range.start, range.end), [range]);
  const isSingleMonth = buckets.length <= 1;

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: cats }, { data: bgts }, { data: curr }] = await Promise.all([
      supabase.from('categories').select('*').eq('user_id', user.id),
      supabase.from('budgets').select('*').eq('user_id', user.id),
      supabase.from('custom_currencies').select('*').eq('user_id', user.id),
    ]);
    setCategories(cats || []);
    setBudgets(bgts || []);
    setCustomCurrencies(curr || []);

    let txQuery = supabase.from('transactions').select('*, categories(name)')
      .gte('entry_date', range.start).lte('entry_date', range.end);
    // 'mine': only my rows. 'household': RLS already includes my rows +
    // other members' household-flagged rows, so no extra filter needed.
    if (view === 'mine') txQuery = txQuery.eq('user_id', user.id);
    const { data: tx } = await txQuery;
    setTransactions(tx || []);

    if (profile?.household_id) {
      const { data: members } = await supabase.from('profiles').select('id, display_name').eq('household_id', profile.household_id);
      setHouseholdMembers(members || []);
    }
    setLoading(false);
  }, [user.id, range.start, range.end, view, profile?.household_id]);

  useEffect(() => { load(); }, [load]);

  // ---- Summary ----
  const income = transactions.filter((t) => t.direction === 'inflow').reduce((s, t) => s + t.amount_eur, 0);
  const expense = transactions.filter((t) => t.direction === 'outflow').reduce((s, t) => s + t.amount_eur, 0);
  const net = income - expense;

  // ---- Operational vs Nonoperational ----
  const opGroups = ['Operational', 'Nonoperational'].map((sc) => {
    const rows = transactions.filter((t) => t.subcategory_snapshot === sc);
    const total = rows.reduce((s, t) => s + (t.direction === 'outflow' ? -t.amount_eur : t.amount_eur), 0);
    return { subcategory: sc, total, rows };
  });

  // ---- Budget vs Actual per category ----
  // NOTE (household view): budgets are per-user master data, matched
  // across members by trimmed/case-insensitive category name - not a
  // shared row. See warning banner below.
  const categoryRows = useMemo(() => {
    const byName = new Map();
    for (const c of categories) {
      const key = c.name.trim().toLowerCase();
      if (!byName.has(key)) byName.set(key, { name: c.name, subcategory: c.subcategory, categoryIds: [] });
      byName.get(key).categoryIds.push(c.id);
    }
    return Array.from(byName.values()).map((group) => {
      const rows = transactions.filter((t) => group.categoryIds.includes(t.category_id));
      const actual = rows.reduce((s, t) => s + (t.direction === 'outflow' ? -t.amount_eur : t.amount_eur), 0);
      const direction = rows[0]?.direction || (group.subcategory === 'Operational' && group.name.match(/salary|income/i) ? 'inflow' : 'outflow');
      const budgetsForGroup = budgets.filter((b) => group.categoryIds.includes(b.category_id));
      const budgetTotal = totalBudgetOverBuckets(budgetsForGroup, buckets);
      const status = varianceStatus(Math.abs(actual), budgetTotal, actual >= 0 ? 'inflow' : 'outflow');
      return { ...group, actual, budgetTotal, status, rows };
    }).filter((g) => g.rows.length > 0 || g.budgetTotal !== null);
  }, [categories, transactions, budgets, buckets]);

  // ---- Chart data ----
  const chartData = isSingleMonth
    ? categoryRows.map((g) => ({ name: g.name, actual: Math.abs(g.actual), budget: g.budgetTotal || 0 }))
    : buckets.map((b) => {
        const rows = transactions.filter((t) => t.entry_date >= b.start && t.entry_date <= b.end);
        const monthIncome = rows.filter((t) => t.direction === 'inflow').reduce((s, t) => s + t.amount_eur, 0);
        const monthExpense = rows.filter((t) => t.direction === 'outflow').reduce((s, t) => s + t.amount_eur, 0);
        return { name: b.label, net: monthIncome - monthExpense };
      });

  const showHouseholdMismatchWarning = view === 'household';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Dashboard</h2>
        <button className="btn btn-primary" onClick={() => setAddingEntry(true)}>Add entry</button>
      </div>

      {profile?.household_id && (
        <div className="pill-row" style={{ marginTop: 16 }}>
          <button className={`pill ${view === 'mine' ? 'active' : ''}`} onClick={() => setView('mine')}>My view</button>
          <button className={`pill ${view === 'household' ? 'active' : ''}`} onClick={() => setView('household')}>Household view</button>
        </div>
      )}

      {showHouseholdMismatchWarning && (
        <div className="warning-banner">
          Household totals match categories by name only (case/whitespace-insensitive). If members haven't aligned
          category names, some entries may show up as separate, unmatched lines instead of combining. Review this
          under Master data with other household members.
        </div>
      )}

      {/* ---- Date filter ---- */}
      <div className="pill-row" style={{ marginTop: 20 }}>
        {[['this_month','This month'],['3m','3M'],['6m','6M'],['12m','12M'],['ytd','YTD'],['year','Year'],['all','All time'],['range','Custom range']].map(([k,label]) => (
          <button key={k} className={`pill ${dash.period === k ? 'active' : ''}`} onClick={() => setDash((d) => ({ ...d, period: k, monthOffset: 0 }))}>{label}</button>
        ))}
      </div>

      {dash.period === 'year' && (
        <div className="field" style={{ maxWidth: 160 }}>
          <select value={dash.yearSelect} onChange={(e) => setDash((d) => ({ ...d, yearSelect: Number(e.target.value) }))}>
            {Array.from({ length: 10 }, (_, i) => CURRENT_YEAR - i).map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      )}

      {dash.period === 'range' && (
        <div className="field-row" style={{ maxWidth: 340 }}>
          <div className="field">
            <label>From</label>
            <input type="date" value={dash.rangeStart} onChange={(e) => setDash((d) => ({ ...d, rangeStart: e.target.value }))} />
          </div>
          <div className="field">
            <label>To</label>
            <input type="date" value={dash.rangeEnd} onChange={(e) => setDash((d) => ({ ...d, rangeEnd: e.target.value }))} />
          </div>
        </div>
      )}

      {dash.period === 'this_month' && (
        <div className="month-nav">
          <button onClick={() => setDash((d) => ({ ...d, monthOffset: d.monthOffset - 1 }))}>‹</button>
          <span className="month-label mono">{range.label}</span>
          <button onClick={() => setDash((d) => ({ ...d, monthOffset: d.monthOffset + 1 }))}>›</button>
        </div>
      )}

      {loading ? <p style={{ color: 'var(--text-dim)' }}>Loading…</p> : (
        <>
          {/* ---- Summary ---- */}
          <div className="summary-row">
            <div className="card summary-tile">
              <div className="label">Income</div>
              <div className="value positive mono">€{income.toFixed(2)}</div>
            </div>
            <div className="card summary-tile">
              <div className="label">Expenses</div>
              <div className="value negative mono">€{expense.toFixed(2)}</div>
            </div>
            <div className="card summary-tile">
              <div className="label">Net</div>
              <div className={`value mono ${net >= 0 ? 'positive' : 'negative'}`}>{net >= 0 ? '+' : ''}€{net.toFixed(2)}</div>
            </div>
          </div>

          {/* ---- Operational / Nonoperational ---- */}
          <div className="section-heading">Operational vs. nonoperational</div>
          <div className="summary-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {opGroups.map((g) => (
              <div key={g.subcategory} className="card" style={{ cursor: 'pointer' }} onClick={() => setDrillCategory({ name: g.subcategory, rows: g.rows, showCategory: true })}>
                <div className="label" style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>
                  <span className={`tag ${g.subcategory.toLowerCase()}`}>{g.subcategory}</span>
                </div>
                <div className={`value mono ${g.total >= 0 ? 'positive' : 'negative'}`}>{g.total >= 0 ? '+' : ''}€{g.total.toFixed(2)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>{g.rows.length} entries — click to view</div>
              </div>
            ))}
          </div>

          {/* ---- Budget vs Actual ---- */}
          <div className="section-heading">Budget vs. actual by category</div>
          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table>
              <thead><tr><th>Category</th><th>Actual</th><th>Budget</th><th>Variance</th></tr></thead>
              <tbody>
                {categoryRows.map((g) => {
                  const varianceVal = g.budgetTotal !== null ? Math.abs(g.actual) - g.budgetTotal : null;
                  return (
                    <tr key={g.name} onClick={() => setDrillCategory({ ...g, showCategory: false })} style={{ cursor: 'pointer' }}>
                      <td>{g.name} <span className={`tag ${g.subcategory.toLowerCase()}`}>{g.subcategory}</span></td>
                      <td className="mono">€{Math.abs(g.actual).toFixed(2)}</td>
                      <td className="mono">{g.budgetTotal !== null ? `€${g.budgetTotal.toFixed(2)}` : '—'}</td>
                      <td className={`mono ${g.status === 'positive' ? 'positive' : g.status === 'negative' ? 'negative' : ''}`}>
                        {varianceVal !== null ? `${varianceVal >= 0 ? '+' : ''}€${varianceVal.toFixed(2)}` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ---- Chart ---- */}
          <div className="section-heading">{isSingleMonth ? 'Budget vs. actual this month' : 'Net over time'}</div>
          <div className="card" style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              {isSingleMonth ? (
                <BarChart data={chartData}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="name" stroke="var(--text-dim)" fontSize={11} />
                  <YAxis stroke="var(--text-dim)" fontSize={11} />
                  <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)' }} />
                  <Legend />
                  <Bar dataKey="actual" fill="var(--accent)" name="Actual" radius={[4,4,0,0]} />
                  <Bar dataKey="budget" fill="var(--violet)" name="Budget" radius={[4,4,0,0]} />
                </BarChart>
              ) : (
                <LineChart data={chartData}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="name" stroke="var(--text-dim)" fontSize={11} />
                  <YAxis stroke="var(--text-dim)" fontSize={11} />
                  <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)' }} />
                  <Line type="monotone" dataKey="net" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* ---- Drill-down popup ---- */}
      {drillCategory && (
        <div className="modal-backdrop" onClick={() => setDrillCategory(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 14 }}>{drillCategory.name}</h3>
            <table>
              <thead><tr><th>Date</th><th>Amount</th><th>{drillCategory.showCategory ? 'Category' : 'Note'}</th></tr></thead>
              <tbody>
                {drillCategory.rows.map((t) => (
                  <tr key={t.id}>
                    <td className="mono">{t.entry_date}</td>
                    <td className={`mono ${t.direction === 'outflow' ? 'negative' : 'positive'}`}>
                      {t.direction === 'outflow' ? '-' : '+'}€{t.amount_eur.toFixed(2)}
                    </td>
                    <td style={{ color: 'var(--text-dim)' }}>
                      {drillCategory.showCategory ? (t.categories?.name || '—') : (t.note || '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn btn-ghost" style={{ marginTop: 14 }} onClick={() => setDrillCategory(null)}>Close</button>
          </div>
        </div>
      )}

      {addingEntry && (
        <EntryModal
          userId={user.id}
          householdId={profile?.household_id}
          categories={categories}
          customCurrencies={customCurrencies}
          existing={null}
          onClose={() => setAddingEntry(false)}
          onSaved={() => { setAddingEntry(false); load(); }}
        />
      )}
    </div>
  );
}
