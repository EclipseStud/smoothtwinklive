import { Clerk } from '@clerk/clerk-js';

const currentYear = document.querySelector('[data-current-year]');

if (currentYear) {
  currentYear.textContent = String(new Date().getFullYear());
}

const tracking = window.EclipseStudTracking;

if (tracking) {
  tracking.record('landing_page_view');
  document.querySelectorAll('[data-referral-link]').forEach((cta) => {
    cta.addEventListener('click', () => {
      const mood = cta.dataset.mood;
      if (mood) tracking.record('mood_selection', { mood });
      tracking.record('stripchat_cta_click', { cta_location: cta.dataset.ctaLocation || 'homepage', mood: mood || null });
    });
  });
}

const gate = document.querySelector('[data-account-gate]');
const signInButton = document.querySelector('[data-clerk-sign-in]');
const ageForm = document.querySelector('[data-age-form]');
const ageConfirmation = document.querySelector('[data-age-confirmation]');
const retryButton = document.querySelector('[data-gate-retry]');
const gateMessage = document.querySelector('[data-gate-message]');
const accountMount = document.querySelector('[data-clerk-account]');
const protectedImages = [...document.querySelectorAll('[data-protected-media]')];
const objectUrls = new Set();

function setGateState(state, message) {
  if (!gate) return;
  gate.dataset.state = state;
  gateMessage.textContent = message;
  signInButton.hidden = state !== 'signed-out';
  ageForm.hidden = state !== 'needs-attestation';
  retryButton.hidden = state !== 'error';
}

function clearProtectedMedia() {
  for (const url of objectUrls) URL.revokeObjectURL(url);
  objectUrls.clear();
}

async function loadProtectedImages(token) {
  for (const mediaId of new Set(protectedImages.map((image) => image.dataset.protectedMedia))) {
    const response = await fetch(`/api/media/${mediaId}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    if (!response.ok) throw new Error('Protected preview unavailable');
    const objectUrl = URL.createObjectURL(await response.blob());
    objectUrls.add(objectUrl);
    for (const image of protectedImages.filter((item) => item.dataset.protectedMedia === mediaId)) {
      image.src = objectUrl;
      image.alt = image.dataset.protectedAlt;
    }
  }
  setGateState('authorized', '18+ previews unlocked for this account.');
  tracking?.record('protected_media_unlocked');
}

async function initializeProtectedMediaGate() {
  const publishableKey = document.querySelector('meta[name="clerk-publishable-key"]')?.content;
  if (!gate || !publishableKey || publishableKey.includes('{{')) {
    setGateState('error', 'Account access is not configured yet.');
    return;
  }
  const clerk = new Clerk(publishableKey);
  await clerk.load();
  if (!clerk.isSignedIn || !clerk.session) {
    setGateState('signed-out', 'Sign in with Clerk to unlock 18+ previews.');
    tracking?.record('auth_prompt_view');
    signInButton.addEventListener('click', () => clerk.openSignIn({
      signInFallbackRedirectUrl: window.location.href,
      signUpFallbackRedirectUrl: window.location.href,
    }));
    return;
  }
  if (accountMount) clerk.mountUserButton(accountMount);
  const token = await clerk.session.getToken();
  const response = await fetch('/api/access-status', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!response.ok) throw new Error('Account access check failed');
  const status = await response.json();
  if (!status.ageAttested) {
    setGateState('needs-attestation', 'Confirm you are 18 or older to unlock previews.');
    ageForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!ageConfirmation.checked) return ageConfirmation.focus();
      try {
        const confirmation = await fetch('/api/age-attestation', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirmed: true }),
        });
        if (!confirmation.ok) throw new Error('Age confirmation failed');
        tracking?.record('age_attestation_complete');
        await loadProtectedImages(token);
      } catch {
        setGateState('error', 'Preview access failed. Please retry.');
      }
    }, { once: true });
    return;
  }
  await loadProtectedImages(token);
}

retryButton?.addEventListener('click', () => window.location.reload());
window.addEventListener('pagehide', clearProtectedMedia);
initializeProtectedMediaGate().catch(() => setGateState('error', 'Preview access failed. Please retry.'));
