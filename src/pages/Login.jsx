import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { clearStoredConfig } from '../lib/config';

export default function Login() {
  const [mode, setMode] = useState('sign_in'); // 'sign_in' | 'sign_up'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'sign_up') {
        const { error: err } = await supabase.auth.signUp({
          email, password,
          options: { data: { display_name: displayName || email } },
        });
        if (err) throw err;
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form onSubmit={submit} className="card" style={{ width: 360 }}>
        <h1 style={{ marginBottom: 4 }}>Flow<span style={{ color: 'var(--accent)' }}>Track</span></h1>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 20 }}>
          {mode === 'sign_up' ? 'Create your account' : 'Log in to your account'}
        </p>

        {mode === 'sign_up' && (
          <div className="field">
            <label>Display name</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Alex" />
          </div>
        )}
        <div className="field">
          <label>Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        {error && <div className="warning-banner">{error}</div>}

        <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>
          {busy ? 'Please wait…' : mode === 'sign_up' ? 'Sign up' : 'Log in'}
        </button>

        <button
          type="button"
          className="btn btn-ghost"
          style={{ width: '100%', marginTop: 10 }}
          onClick={() => setMode(mode === 'sign_up' ? 'sign_in' : 'sign_up')}
        >
          {mode === 'sign_up' ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
        </button>

        <button
          type="button"
          className="btn btn-ghost"
          style={{ width: '100%', marginTop: 10, fontSize: 12, color: 'var(--text-dim)' }}
          onClick={() => { clearStoredConfig(); window.location.reload(); }}
        >
          Connect to a different Supabase project
        </button>
      </form>
    </div>
  );
}
