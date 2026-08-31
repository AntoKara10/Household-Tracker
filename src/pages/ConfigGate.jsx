import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { setStoredConfig } from '../lib/config';
import { resetClient } from '../lib/supabaseClient';

export default function ConfigGate({ onConfigured }) {
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const trimmedUrl = url.trim().replace(/\/$/, '');
      const trimmedKey = anonKey.trim();
      const testClient = createClient(trimmedUrl, trimmedKey);
      // Lightweight reachability check - doesn't require being logged in.
      const { error: err } = await testClient.auth.getSession();
      if (err) throw err;
      setStoredConfig(trimmedUrl, trimmedKey);
      resetClient();
      onConfigured();
    } catch (err) {
      setError('Could not connect with those values. Double-check the project URL and anon key in Supabase → Project Settings → API.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form onSubmit={submit} className="card" style={{ width: 400 }}>
        <h1 style={{ marginBottom: 4 }}>Flow<span style={{ color: 'var(--accent)' }}>Track</span></h1>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 20 }}>
          Connect this device to your Supabase project. This is only asked once per browser/device -
          it's stored locally, not sent anywhere else.
        </p>
        <div className="field">
          <label>Project URL</label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxxx.supabase.co" required />
        </div>
        <div className="field">
          <label>Anon public key</label>
          <input value={anonKey} onChange={(e) => setAnonKey(e.target.value)} required />
        </div>
        {error && <div className="warning-banner">{error}</div>}
        <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>
          {busy ? 'Connecting…' : 'Connect'}
        </button>
      </form>
    </div>
  );
}
