import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

const MOBILE_QUERY = '(max-width: 767px)';

function isMobile() {
  return window.matchMedia(MOBILE_QUERY).matches;
}

/**
 * Builds an inline expandable site-search form. The search icon comes from the
 * nav fragment (authored as :search:); clicking it toggles the form.
 * @param {Element} icon The decorated search icon span from the fragment
 * @returns {HTMLElement} the search wrapper
 */
function buildSearch(icon) {
  const search = document.createElement('div');
  search.className = 'nav-search';

  const toggle = document.createElement('button');
  toggle.className = 'nav-search-toggle';
  toggle.type = 'button';
  toggle.setAttribute('aria-label', 'Search');
  toggle.setAttribute('aria-expanded', 'false');
  if (icon) toggle.append(icon);

  const form = document.createElement('form');
  form.className = 'nav-search-form';
  form.action = '/search';
  form.method = 'GET';

  const input = document.createElement('input');
  input.className = 'nav-search-input';
  input.type = 'text';
  input.name = 'q';
  input.setAttribute('aria-label', 'Search');

  const submit = document.createElement('button');
  submit.className = 'nav-search-submit';
  submit.type = 'submit';
  submit.textContent = 'GO';

  form.append(input, submit);

  toggle.addEventListener('click', () => {
    const open = search.classList.toggle('nav-search-open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) input.focus();
  });

  search.append(toggle, form);
  return search;
}

/**
 * Builds a hamburger toggle button for mobile. Toggles the nav open class.
 * @param {HTMLElement} nav The nav element
 * @returns {HTMLElement} the hamburger button
 */
function buildHamburger(nav) {
  const hamburger = document.createElement('button');
  hamburger.className = 'nav-hamburger';
  hamburger.type = 'button';
  hamburger.setAttribute('aria-label', 'Open menu');
  hamburger.setAttribute('aria-expanded', 'false');

  const label = document.createElement('span');
  label.className = 'nav-hamburger-label';
  label.textContent = 'MENU';

  const bars = document.createElement('span');
  bars.className = 'nav-hamburger-bars';
  bars.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 3; i += 1) {
    const bar = document.createElement('span');
    bar.className = 'nav-hamburger-bar';
    bars.append(bar);
  }

  hamburger.append(label, bars);

  hamburger.addEventListener('click', () => {
    const open = nav.classList.toggle('nav-open');
    hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
    hamburger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });

  return hamburger;
}

/**
 * loads and decorates the header
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';
  // local/aem-up serves content under /content; DA/EDS production serves at navPath
  const fragment = (await loadFragment('/content/nav')) || (await loadFragment(navPath));

  block.textContent = '';
  const nav = document.createElement('nav');
  nav.id = 'nav';
  nav.setAttribute('aria-label', 'Main navigation');

  // Fragment sections in natural reading order:
  // 0 = prescribing-context text bar, 1 = logo + eyebrow links, 2 = main nav + search
  const [textSection, eyebrowSection, mainSection] = [...fragment.children];

  // Row 0 — prescribing-context text bar
  if (textSection) {
    const textBar = document.createElement('div');
    textBar.className = 'nav-textbar';
    const p = textSection.querySelector('p');
    if (p) textBar.append(p);
    nav.append(textBar);
  }

  // Build the single search element (relocated by viewport: desktop = main row,
  // mobile = brand controls — matching the source).
  const searchIcon = mainSection ? mainSection.querySelector('.icon-search, span.icon') : null;
  const search = buildSearch(searchIcon);
  const searchItem = document.createElement('li');
  searchItem.className = 'nav-search-item';
  searchItem.append(search);

  let brandControls = null;
  let mainList = null;

  // Brand: logo + (mobile) search + hamburger. Logo overlaps the bands.
  if (eyebrowSection) {
    const brand = document.createElement('div');
    brand.className = 'nav-brand';
    const logoLink = eyebrowSection.querySelector('p a');
    if (logoLink) brand.append(logoLink);

    brandControls = document.createElement('div');
    brandControls.className = 'nav-brand-controls';
    brandControls.append(buildHamburger(nav));
    brand.append(brandControls);

    nav.append(brand);
  }

  // Row 1 — eyebrow utility links (direct nav > ul for faithful nav landmark)
  if (eyebrowSection) {
    const ul = eyebrowSection.querySelector('ul');
    if (ul) {
      ul.className = 'nav-eyebrow-links';
      nav.append(ul);
    }
  }

  // Row 2 — main nav links (search appended on desktop)
  if (mainSection) {
    const ul = mainSection.querySelector('ul');
    if (ul) {
      ul.className = 'nav-main-list';
      mainList = ul;
      nav.append(ul);
    }
  }

  // Place search: brand controls on mobile, main row on desktop
  const placeSearch = () => {
    if (isMobile()) {
      if (brandControls && search.parentElement !== brandControls) {
        brandControls.insertBefore(search, brandControls.firstChild);
      }
    } else if (mainList && searchItem.parentElement !== mainList) {
      searchItem.append(search);
      mainList.append(searchItem);
    }
  };
  placeSearch();

  // Close mobile menu / collapse search and relocate search when crossing breakpoint
  window.matchMedia(MOBILE_QUERY).addEventListener('change', (e) => {
    placeSearch();
    nav.querySelectorAll('.nav-search-open').forEach((s) => s.classList.remove('nav-search-open'));
    if (!e.matches) {
      nav.classList.remove('nav-open');
      const hamburger = nav.querySelector('.nav-hamburger');
      if (hamburger) {
        hamburger.setAttribute('aria-expanded', 'false');
        hamburger.setAttribute('aria-label', 'Open menu');
      }
    }
  });

  // Close expanded search when clicking outside
  document.addEventListener('click', (e) => {
    if (isMobile()) return;
    nav.querySelectorAll('.nav-search-open').forEach((s) => {
      if (!s.contains(e.target)) {
        s.classList.remove('nav-search-open');
        const t = s.querySelector('.nav-search-toggle');
        if (t) t.setAttribute('aria-expanded', 'false');
      }
    });
  });

  // Scroll-progress bar below the nav (matches source .progress-container)
  const progress = document.createElement('div');
  progress.className = 'nav-progress';
  const progressBar = document.createElement('div');
  progressBar.className = 'nav-progress-bar';
  progress.append(progressBar);
  nav.append(progress);

  let progressTicking = false;
  const updateProgress = () => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const pct = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
    progressBar.style.width = `${pct}%`;
    progressTicking = false;
  };
  window.addEventListener('scroll', () => {
    if (!progressTicking) {
      window.requestAnimationFrame(updateProgress);
      progressTicking = true;
    }
  });

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';
  navWrapper.append(nav);
  block.append(navWrapper);
}
