import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext.jsx';

export default function Household() {
  const { user, profile, refreshProfile } = useAuth();
  const [household, setHousehold] = useState(null);
  const [members, setMembers] = useState([]);
  const [newName, setNewName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.household_id) { setHousehold(null); setMembers([]); return; }
    const { data: h } = await supabase.from('households').select('*').eq('id', profile.household_id).single();
    const { data: m } = await supabase.from('profiles').select('id, display_name').eq('household_id', profile.household_id);
    setHousehold(h);
    setMembers(m || []);
  }, [profile?.household_id]);

  useEffect(() => { load(); }, [load]);

  async function createHousehold(e) {
    e.preventDefault();
    setError(null);
    if (!newName.trim()) return;
    setBusy(true);
    const { data, error: err } = await supabase.from('households').insert({ name: newName.trim() }).select().single();
    if (err) { setError(err.message); setBusy(false); return; }
    const { error: profErr } = await supabase.from('profiles').update({ household_id: data.id }).eq('id', user.id);
    setBusy(false);
    if (profErr) { setError(profErr.message); return; }
    await refreshProfile();
  }

  async function joinHousehold(e) {
    e.preventDefault();
    setError(null);
    if (!inviteCode.trim()) return;
    setBusy(true);
    const { error: err } = await supabase.rpc('join_household', { p_invite_code: inviteCode.trim() });
    setBusy(false);
    if (err) { setError(err.message); return; }
    await refreshProfile();
  }

  async function leaveHousehold() {
    if (!confirm('Leave this household? You will lose access to shared entries.')) return;
    await supabase.from('profiles').update({ household_id: null }).eq('id', user.id);
    await refreshProfile();
  }

  return (
    <div>
      <h2>Household</h2>
      <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>
        Sharing an entry as "Household" on the entry form makes it visible to everyone in your household.
        Your private entries always stay visible only to you. Categories, subcategories, and budgets are never
        shared directly — they're combined by matching names across members.
      </p>

      {error && <div className="warning-banner">{error}</div>}

      {household ? (
        <div className="card">
          <h3 style={{ marginBottom: 4 }}>{household.name}</h3>
          <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>
            Invite code: <span className="mono" style={{ color: 'var(--accent)' }}>{household.invite_code}</span>
          </p>
          <div className="section-heading">Members</div>
          <ul style={{ paddingLeft: 18, color: 'var(--text)' }}>
            {members.map((m) => <li key={m.id}>{m.display_name}{m.id === user.id ? ' (you)' : ''}</li>)}
          </ul>
          <button className="btn btn-danger" style={{ marginTop: 12 }} onClick={leaveHousehold}>Leave household</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr' }}>
          <form onSubmit={createHousehold} className="card">
            <h3 style={{ marginBottom: 12 }}>Create a household</h3>
            <div className="field">
              <label>Household name</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. The Papadopoulos house" />
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy}>Create</button>
          </form>
          <form onSubmit={joinHousehold} className="card">
            <h3 style={{ marginBottom: 12 }}>Join with an invite code</h3>
            <div className="field">
              <label>Invite code</label>
              <input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="e.g. a1b2c3d4" />
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy}>Join</button>
          </form>
        </div>
      )}
    </div>
  );
}
