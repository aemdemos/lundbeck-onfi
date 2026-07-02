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

// Slug of a heading's text, matching the id the delivery pipeline assigns.
function slugify(text) {
  return text.trim().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

// Ensure every heading carries its slug id. The published pipeline assigns
// these automatically, but the local preview does not — assigning here makes
// "#slug" targets resolve identically in both. Existing ids are preserved.
function ensureHeadingIds(main) {
  main.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((h) => {
    if (h.closest('.page-nav')) return;
    if (!h.id && h.textContent.trim()) h.id = slugify(h.textContent);
  });
}

export default function decorate(block) {
  const main = document.querySelector('main');
  if (!main) return;

  const offset = headerOffset();
  ensureHeadingIds(main);

  // Resolve a target id to its element. Authors point at a heading's id (e.g.
  // "#helpful-resources"); restrict to same-page ids inside main.
  const findTarget = (id) => {
    if (!id) return null;
    const el = document.getElementById(id);
    return el && main.contains(el) && !el.closest('.page-nav') ? el : null;
  };

  // Each block row is two cells: [Label, Target]. The target is written as
  // plain text and is one of:
  //   #some-id   → scroll to the element with that id (a heading's id)
  //   /path      → navigate to another page
  //   https://…  → navigate to an external URL
  // Plain "#id" text survives publishing (only <a href="#…"> would be stripped),
  // so the anchor id travels intact. A link in the target cell also supplies a
  // navigation URL.
  const entries = [...block.children]
    .map((row) => {
      const cells = [...row.children];
      const label = (cells[0]?.textContent || '').trim();
      const targetCell = cells[1];
      if (!label || !targetCell) return null;
      const link = targetCell.querySelector('a[href]');
      const href = link ? link.getAttribute('href') : '';
      const targetText = targetCell.textContent.trim();
      // A "#id" target scrolls to that element; anything else navigates.
      if (!href && targetText.startsWith('#')) {
        return { type: 'anchor', label, id: targetText.slice(1) };
      }
      return { type: 'link', label, href: href || targetText };
    })
    .filter((e) => e && (e.type === 'link' ? e.href : e.id));

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

    if (entry.type === 'anchor') {
      a.href = `#${entry.id}`;
      // Resolve the heading lazily: it may render after this block (or, in the
      // preview, gain its id later). Cached once found.
      entry.resolve = () => {
        if (!entry.target || !entry.target.isConnected) {
          entry.target = findTarget(entry.id);
          if (entry.target) {
            entry.target.style.scrollMarginTop = `${offset + 20}px`;
          }
        }
        return entry.target;
      };
      a.addEventListener('click', (e) => {
        const target = entry.resolve();
        if (!target) return; // let the browser handle the hash if unresolved
        e.preventDefault();
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
        window.history.replaceState(null, '', `#${target.id || entry.id}`);
      });
      entry.a = a;
      anchorEntries.push(entry);
    } else {
      a.href = entry.href;
    }

    li.append(a);
    list.append(li);
    navLinks.push(a);
  });

  nav.append(list);
  block.append(nav);

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
    // Sections may render after this block; keep late headings id'd so their
    // targets resolve.
    ensureHeadingIds(main);
    // Resolve targets (they may render late) and order by document position so
    // the scrollspy tracks correctly regardless of the authored row order.
    const domOrder = [...main.querySelectorAll('h1,h2,h3,h4,h5,h6')];
    const resolved = anchorEntries
      .map((entry) => ({ entry, target: entry.resolve() }))
      .filter((r) => r.target)
      .sort((a, b) => domOrder.indexOf(a.target) - domOrder.indexOf(b.target));
    if (resolved.length) {
      const line = offset + 40;
      // Only honor "at bottom" once actually scrolled — on a fresh load the page
      // height isn't settled and would falsely read as bottom (selecting the last item).
      const atBottom = window.scrollY > 0 && window.innerHeight + window.scrollY
        >= document.documentElement.scrollHeight - 2;
      if (atBottom) {
        setActive(resolved.at(-1).entry);
      } else {
        let current = resolved[0].entry;
        resolved.forEach(({ entry, target }) => {
          if (target.getBoundingClientRect().top <= line) current = entry;
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
