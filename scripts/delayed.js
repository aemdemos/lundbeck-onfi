// add delayed functionality here
import { loadScript } from './aem.js';

// CookieInformation consent management platform (same CMP as www.vyepti.com)
async function loadConsentManager() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('martech') === 'off') return;

  window.cookieInformationCustomConfig = {
    acceptFrequency: 365,
    declineFrequency: 365,
  };

  await loadScript('https://policy.app.cookieinformation.com/uc.js', {
    id: 'CookieConsent',
    'data-culture': 'EN',
    type: 'text/javascript',
  });
}

loadConsentManager();
