const tracking = window.EclipseStudTracking;
const source = tracking?.sourceFromPath() || 'direct';

document.body.dataset.trafficSource = source;

if (tracking) {
  tracking.record('live_page_view');
  document.querySelectorAll('[data-referral-link]').forEach((cta) => {
    cta.addEventListener('click', () => {
      const mood = cta.dataset.mood;
      if (mood) tracking.record('mood_selection', { mood });
      tracking.record('stripchat_cta_click', { cta_location: cta.dataset.ctaLocation || 'live', mood: mood || null });
    });
  });
}
