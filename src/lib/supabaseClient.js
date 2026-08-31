import { createClient } from '@supabase/supabase-js';
import { getStoredConfig } from './config';

let _client = null;

function getRealClient() {
  if (_client) return _client;
  const cfg = getStoredConfig();
  if (!cfg) {
    // Should never happen: RootGate blocks rendering of anything that
    // uses `supabase` until config exists.
    throw new Error('FlowTrack is not connected to a Supabase project yet.');
  }
  _client = createClient(cfg.url, cfg.anonKey);
  return _client;
}

// A lazy proxy so every existing `import { supabase } from '.../supabaseClient'`
// call site keeps working unchanged, while the real client is only created
// once the user has entered their project URL/anon key (see ConfigGate.jsx).
export const supabase = new Proxy(
  {},
  {
    get(_target, prop) {
      const client = getRealClient();
      const value = client[prop];
      return typeof value === 'function' ? value.bind(client) : value;
    },
  }
);

// Call after storing new config (or on disconnect) to force re-creation.
export function resetClient() {
  _client = null;
}
