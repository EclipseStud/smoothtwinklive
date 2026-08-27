const supportedSources = new Set(['x', 'reddit', 'bluesky', 'ad', 'direct']);
const eventStorageKey = 'eclipseStudFunnelEvents';
const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign'];

function cleanUtmValue(value) {
  const normalized = (value || '').trim();
  return /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(normalized) ? normalized : null;
}

function utmContext() {
  const params = new URLSearchParams(window.location.search);
  return Object.fromEntries(
    utmKeys
      .map((key) => [key, cleanUtmValue(params.get(key))])
      .filter(([, value]) => value),
  );
}

function sourceFromPath() {
  const taggedSource = utmContext().utm_source;
  if (taggedSource) return taggedSource;
  const pathSource = window.location.pathname.split('/')[2] || 'direct';
  return supportedSources.has(pathSource) ? pathSource : 'direct';
}

function record(type, details = {}) {
  const event = { type, source: sourceFromPath(), timestamp: new Date().toISOString(), ...utmContext(), ...details };
  const existing = JSON.parse(sessionStorage.getItem(eventStorageKey) || '[]');
  sessionStorage.setItem(eventStorageKey, JSON.stringify([...existing, event].slice(-20)));
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: `eclipsestud_${type}`, traffic_source: event.source, ...details });
  window.dispatchEvent(new CustomEvent('eclipsestud:analytics', { detail: event }));
}

window.EclipseStudTracking = { record, sourceFromPath, utmContext };
