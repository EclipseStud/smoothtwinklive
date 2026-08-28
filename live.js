const tracking = window.EclipseStudTracking;
const source = tracking?.sourceFromPath() || 'direct';

document.body.dataset.trafficSource = source;

if (tracking) {
  tracking.record('live_page_view');
  document.querySelectorAll('[data-referral-link]').forEach((cta) => {
    cta.addEventListener('click', () => {
      tracking.record('stripchat_cta_click', { cta_location: cta.dataset.ctaLocation || 'live' });
    });
  });
}
