import { useState } from 'react';
import { getStoredConfig } from './lib/config';
import { AuthProvider } from './lib/AuthContext.jsx';
import ConfigGate from './pages/ConfigGate.jsx';
import App from './App.jsx';

// Gatekeeper: nothing that touches `supabase` (AuthProvider included) is
// mounted until a project URL/anon key has been entered and stored for
// this device. This is what lets you distribute the app without a
// Supabase connection baked in at build time.
export default function RootGate() {
  const [configured, setConfigured] = useState(!!getStoredConfig());

  if (!configured) {
    return <ConfigGate onConfigured={() => setConfigured(true)} />;
  }

  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}
