const currentYear = document.querySelector('[data-current-year]');
if (currentYear) currentYear.textContent = String(new Date().getFullYear());

const tracking = window.EclipseStudTracking;
tracking?.record('landing_page_view');
document.querySelectorAll('[data-referral-link]').forEach((cta) => {
  cta.addEventListener('click', () => {
    tracking?.record('stripchat_cta_click', { cta_location: cta.dataset.ctaLocation || 'homepage' });
  });
});

const header = document.querySelector('[data-site-header]');
const updateHeader = () => header?.classList.toggle('is-scrolled', window.scrollY > 24);
updateHeader();
window.addEventListener('scroll', updateHeader, { passive: true });

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!reducedMotion && 'IntersectionObserver' in window) {
  document.documentElement.classList.add('motion-ready');
  const revealObserver = new IntersectionObserver((entries, observer) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach((item) => revealObserver.observe(item));
}

if (!reducedMotion && window.matchMedia('(pointer: fine)').matches) {
  document.querySelectorAll('[data-parallax]').forEach((panel) => {
    panel.addEventListener('pointermove', (event) => {
      const bounds = panel.getBoundingClientRect();
      panel.style.setProperty('--pointer-x', String((event.clientX - bounds.left) / bounds.width - 0.5));
      panel.style.setProperty('--pointer-y', String((event.clientY - bounds.top) / bounds.height - 0.5));
    });
    panel.addEventListener('pointerleave', () => {
      panel.style.setProperty('--pointer-x', '0');
      panel.style.setProperty('--pointer-y', '0');
    });
  });
}

document.querySelectorAll('.faq-list details').forEach((details) => {
  const summary = details.querySelector('summary');
  summary?.setAttribute('aria-expanded', String(details.open));
  details.addEventListener('toggle', () => summary?.setAttribute('aria-expanded', String(details.open)));
});

const previewAccess = document.querySelector('[data-preview-access]');
const previewButton = document.querySelector('[data-preview-confirm]');
const previewMessage = document.querySelector('[data-preview-message]');
const protectedImages = [...document.querySelectorAll('[data-protected-media]')];
const objectUrls = new Set();

function setPreviewState(state, message, buttonLabel = "I'M 18+ — SHOW PREVIEWS") {
  if (!previewAccess || !previewButton || !previewMessage) return;
  previewAccess.dataset.state = state;
  previewMessage.textContent = message;
  previewButton.disabled = state === 'checking' || state === 'loading' || state === 'ready';
  previewButton.hidden = state === 'ready';
  previewButton.textContent = buttonLabel;
}

async function loadProtectedImages() {
  setPreviewState('loading', 'Loading your previews…');
  const mediaIds = [...new Set(protectedImages.map((image) => image.dataset.protectedMedia))];
  await Promise.all(mediaIds.map(async (mediaId) => {
    const response = await fetch(`/api/media/${mediaId}`, { cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) throw new Error('Preview media unavailable');
    const objectUrl = URL.createObjectURL(await response.blob());
    objectUrls.add(objectUrl);
    for (const image of protectedImages.filter((item) => item.dataset.protectedMedia === mediaId)) {
      image.removeAttribute('srcset');
      image.removeAttribute('sizes');
      image.src = objectUrl;
      image.alt = image.dataset.protectedAlt;
      image.closest('.gallery-card')?.classList.add('has-private-media');
    }
  }));
  setPreviewState('ready', 'Previews ready. Your 18+ confirmation is remembered for 30 days.');
  tracking?.record('protected_media_ready');
}

async function checkPreviewSession() {
  if (!previewAccess) return;
  try {
    const response = await fetch('/api/preview-session', { cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) throw new Error('Preview status unavailable');
    const status = await response.json();
    if (status.ageAttested) return loadProtectedImages();
    setPreviewState('ready-to-confirm', 'One click confirms you are 18+ and remembers this browser for 30 days.');
  } catch {
    setPreviewState('error', 'Previews are temporarily unavailable. Try again, or keep going to StripChat.', 'TRY PREVIEWS AGAIN');
  }
}

previewButton?.addEventListener('click', async () => {
  setPreviewState('checking', 'Saving your 18+ confirmation…');
  try {
    const response = await fetch('/api/preview-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ confirmed: true }),
    });
    if (!response.ok) throw new Error('Preview confirmation unavailable');
    tracking?.record('age_attestation_complete');
    await loadProtectedImages();
  } catch {
    setPreviewState('error', 'Previews could not load. Try again, or use any StripChat button.', 'TRY PREVIEWS AGAIN');
  }
});

window.addEventListener('pagehide', () => {
  for (const objectUrl of objectUrls) URL.revokeObjectURL(objectUrl);
  objectUrls.clear();
});

checkPreviewSession();
