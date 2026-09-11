const CLIENT_ID_KEY = 'sudoku-client-id';

/** Stable per-browser id used as the multiplayer player identity across reconnects. */
export function getClientId(): string {
  try {
    const existing = localStorage.getItem(CLIENT_ID_KEY);
    if (existing && existing.length >= 8) {
      return existing;
    }
    const id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `cid-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(CLIENT_ID_KEY, id);
    return id;
  } catch {
    // Private mode / blocked storage — still stable for this page load
    return `cid-session-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  }
}
