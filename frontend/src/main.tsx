import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// #region agent log
(function () {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isIPad = /iPad/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = typeof (navigator as { standalone?: boolean }).standalone !== 'undefined' ? (navigator as { standalone?: boolean }).standalone : null;
  const displayModeStandalone = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(display-mode: standalone)').matches : false;
  const displayModeBrowser = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(display-mode: browser)').matches : false;
  const origin = window.location.origin;
  const pathname = window.location.pathname;
  const appleTouchLink = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
  const appleTouchHref = appleTouchLink ? (appleTouchLink.getAttribute('href') || '') : null;
  const appleTouchResolved = appleTouchHref ? new URL(appleTouchHref, origin).href : null;
  fetch('/manifest.webmanifest')
    .then(r => r.ok ? r.json().then(m => ({ ok: true, status: r.status, display: m.display, start_url: m.start_url, icons: m.icons })) : { ok: false, status: r.status, display: null, start_url: null, icons: null })
    .catch(() => ({ ok: false, status: 0, display: null, start_url: null, icons: null }))
    .then(manifest => {
      const firstIconSrc = manifest.icons && manifest.icons[0] ? manifest.icons[0].src : null;
      const firstIconResolved = firstIconSrc ? new URL(firstIconSrc, origin).href : null;
      return Promise.all([
        firstIconResolved ? fetch(firstIconResolved).then(r => ({ url: firstIconResolved, ok: r.ok, status: r.status })).catch(e => ({ url: firstIconResolved, ok: false, status: 0, err: String(e) })) : Promise.resolve(null),
        appleTouchResolved ? fetch(appleTouchResolved).then(r => ({ url: appleTouchResolved, ok: r.ok, status: r.status })).catch(e => ({ url: appleTouchResolved, ok: false, status: 0, err: String(e) })) : Promise.resolve(null),
      ]).then(([iconFetch, appleFetch]) => ({
        isIOS,
        isIPad,
        standalone,
        displayModeStandalone,
        displayModeBrowser,
        origin,
        pathname,
        url: window.location.href,
        manifest,
        appleTouchHref,
        appleTouchResolved,
        appleTouchHasSizes: appleTouchLink ? appleTouchLink.hasAttribute('sizes') : null,
        iconFetch,
        appleFetch,
      }));
    })
    .then(data => {
      fetch('http://127.0.0.1:7242/ingest/c96d2929-a514-4266-ae0e-7555c7469794', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '2ce0a8' }, body: JSON.stringify({ sessionId: '2ce0a8', location: 'main.tsx:load', message: 'PWA icons and display', data, timestamp: Date.now(), hypothesisId: 'H1' }) }).catch(() => {});
    });
})();
// #endregion

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
