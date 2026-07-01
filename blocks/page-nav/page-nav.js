function headerOffset() {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--header-height').trim();
  const px = parseInt(raw, 10);
  return Number.isNaN(px) ? 0 : px;
}

// Parse an rgb/rgba color string; returns null for transparent or unparseable.
function parseColor(str) {
  const m = str.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const [r, g, b, a = '1'] = m[1].split(',').map((v) => parseFloat(v));
  if (Number(a) === 0) return null;
  return { r, g, b };
}

// Perceived luminance (0 = black, 255 = white).
function luminance({ r, g, b }) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// Walk up from an element to find the first non-transparent background color.
function effectiveBg(el) {
  let node = el;
  while (node && node !== document.documentElement) {
    const color = parseColor(getComputedStyle(node).backgroundColor);
    if (color) return color;
    node = node.parentElement;
  }
  return { r: 255, g: 255, b: 255 };
}

// Unwrap a link into its inline content (keeps text/markup, drops the <a>).
function unwrap(a) {
  a.replaceWith(...a.childNodes);
}

/**
 * Anchor-definition pass. Authors mark a spot on the page by selecting an
 * element (e.g. an H2) and linking it to a fragment such as "#helpful-resources".
 * Here we turn that self-link into a real anchor: set the id on its host element
 * and remove the now-redundant link. Links inside the page-nav block are the
 * navigation list and are left untouched.
 */
function defineAnchors(main) {
  main.querySelectorAll('a[href^="#"]').forEach((a) => {
    if (a.closest('.page-nav')) return;
    const id = a.getAttribute('href').slice(1);
    if (!id) return;
    // If the target already exists elsewhere, this link is plain navigation.
    if (document.getElementById(id)) return;
    const host = a.closest('h1,h2,h3,h4,h5,h6') || a.parentElement;
    if (!host) return;
    host.id = id;
    unwrap(a);
  });
}

export default function decorate(block) {
  const main = document.querySelector('main');
  if (!main) return;

  // First, promote authored in-content fragment links to real anchors.
  defineAnchors(main);

  const offset = headerOffset();

  // The sidebar is driven strictly by the links authored in this block.
  // An in-page anchor (#id) that resolves to a target scrolls and joins the
  // scrollspy; any other link (a URL, or an unresolved #fragment) is treated
  // as ordinary navigation — it just opens, with no scroll behavior.
  const entries = [...block.querySelectorAll('a[href]')]
    .map((a) => {
      const href = a.getAttribute('href');
      const label = a.textContent.trim();
      if (href.startsWith('#')) {
        const target = document.getElementById(href.slice(1));
        if (target) return { type: 'anchor', label, href, target };
      }
      return { type: 'link', label, href };
    })
    .filter((e) => e.label && (e.type === 'anchor' ? e.target : e.href));

  block.textContent = '';

  if (!entries.length) {
    block.closest('.section')?.classList.add('page-nav-empty');
    return;
  }

  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'On this page');
  const list = document.createElement('ul');
  list.className = 'page-nav-items';

  const navLinks = [];
  const anchorEntries = [];

  entries.forEach((entry) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.textContent = entry.label;
    a.href = entry.href;

    if (entry.type === 'anchor') {
      // Align in-page jumps below the sticky header.
      entry.target.style.scrollMarginTop = `${offset + 20}px`;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        entry.target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
        window.history.replaceState(null, '', entry.href);
      });
      entry.a = a;
      anchorEntries.push(entry);
    }

    li.append(a);
    list.append(li);
    navLinks.push(a);
  });

  nav.append(list);
  block.append(nav);

  // Document-ordered anchor list so the scrollspy tracks position regardless
  // of how the author sequenced the links (ordinary links are excluded).
  const domOrder = [...main.querySelectorAll('*')];
  const byDocument = [...anchorEntries]
    .sort((a, b) => domOrder.indexOf(a.target) - domOrder.indexOf(b.target));

  // Push main content to the right of the fixed sidebar (desktop only).
  document.body.classList.add('has-page-nav');

  // Scrollspy: highlight the anchor whose section is currently in view.
  // Ordinary links never get the active state.
  let activeEntry = null;
  const setActive = (entry) => {
    if (entry === activeEntry) return;
    activeEntry = entry;
    anchorEntries.forEach((e) => e.a.classList.toggle('active', e === entry));
  };

  // Flip each link to white where it individually overlaps a dark section.
  // Done per link because the sidebar can straddle two sections with
  // different backgrounds at once.
  const sections = [...main.querySelectorAll(':scope > .section')]
    .filter((s) => !s.querySelector('.page-nav'));
  const darkAt = (y) => {
    const behind = sections.find((s) => {
      const b = s.getBoundingClientRect();
      return b.top <= y && b.bottom >= y;
    });
    return behind ? luminance(effectiveBg(behind)) < 140 : false;
  };
  const adaptColor = () => {
    navLinks.forEach((a) => {
      const r = a.getBoundingClientRect();
      a.classList.toggle('on-dark', darkAt(r.top + r.height / 2));
    });
  };

  const spy = () => {
    if (byDocument.length) {
      const line = offset + 40;
      // Only honor "at bottom" once actually scrolled — on a fresh load the page
      // height isn't settled and would falsely read as bottom (selecting the last item).
      const atBottom = window.scrollY > 0 && window.innerHeight + window.scrollY
        >= document.documentElement.scrollHeight - 2;
      if (atBottom) {
        setActive(byDocument.at(-1));
      } else {
        let current = byDocument[0];
        byDocument.forEach((entry) => {
          if (entry.target.getBoundingClientRect().top <= line) current = entry;
        });
        setActive(current);
      }
    }
    adaptColor();
  };

  // Assess active state and color adaptation immediately (the sidebar may
  // already start over a dark section), then again as layout settles — section
  // backgrounds, fonts and images are applied/loaded asynchronously and shift
  // heading positions, so an early read can pick the wrong item.
  spy();
  requestAnimationFrame(spy);
  window.addEventListener('load', spy);
  window.addEventListener('scroll', spy, { passive: true });
  window.addEventListener('resize', spy, { passive: true });
  // Re-run on any late layout shift (e.g. images finishing) until stable.
  const ro = new ResizeObserver(() => spy());
  ro.observe(document.body);
}
