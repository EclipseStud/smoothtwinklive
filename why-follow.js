const currentYear = document.querySelector('[data-current-year]');
if (currentYear) currentYear.textContent = String(new Date().getFullYear());

const tracking = window.EclipseStudTracking;
tracking?.record('why_follow_page_view');
document.querySelectorAll('[data-referral-link]').forEach((cta) => {
  cta.addEventListener('click', () => tracking?.record('stripchat_cta_click', { cta_location: cta.dataset.ctaLocation || 'why_follow' }));
});

if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
  document.documentElement.classList.add('motion-ready');
  const observer = new IntersectionObserver((entries, instance) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-visible');
      instance.unobserve(entry.target);
    }
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach((item) => observer.observe(item));
}
