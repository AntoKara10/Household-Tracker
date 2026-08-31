const KEY = 'flowtrack_supabase_config';

export function getStoredConfig() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.url || !parsed?.anonKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setStoredConfig(url, anonKey) {
  localStorage.setItem(KEY, JSON.stringify({ url, anonKey }));
}

export function clearStoredConfig() {
  localStorage.removeItem(KEY);
}
