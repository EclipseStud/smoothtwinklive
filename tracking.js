const supportedSources = new Set(['x', 'reddit', 'bluesky', 'ad', 'direct']);
const eventStorageKey = 'eclipseStudFunnelEvents';

function sourceFromPath() {
  const pathSource = window.location.pathname.split('/')[2] || 'direct';
  return supportedSources.has(pathSource) ? pathSource : 'direct';
}

function record(type, details = {}) {
  const event = { type, source: sourceFromPath(), timestamp: new Date().toISOString(), ...details };
  const existing = JSON.parse(sessionStorage.getItem(eventStorageKey) || '[]');
  sessionStorage.setItem(eventStorageKey, JSON.stringify([...existing, event].slice(-20)));
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: `eclipsestud_${type}`, traffic_source: event.source, ...details });
  window.dispatchEvent(new CustomEvent('eclipsestud:analytics', { detail: event }));
}

window.EclipseStudTracking = { record, sourceFromPath };
