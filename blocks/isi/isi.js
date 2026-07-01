/**
 * ISI (Important Safety Information) block — matches onfi.com.
 *
 * Authored as two rows (identical safety copy in each):
 *   Row 1 → the fixed "peek" banner docked to the bottom of the viewport.
 *   Row 2 → the full ISI rendered in normal flow further down the page.
 *
 * Behaviour (source parity):
 *   • The peek banner is `position: fixed` at the viewport bottom, showing the
 *     teal "Important Safety Information" header + the start of the warning box.
 *   • Its toggle reads "+ MORE" and anchor-scrolls down to the full in-flow ISI.
 *   • As the full ISI scrolls up to the top of the viewport the peek fades out
 *     and hides; the full copy (toggle "– LESS", scrolls back to top) takes over.
 *
 * @param {HTMLElement} block
 */

const FULL_ID = 'isi-full';
const FADE_DISTANCE = 300; // px before the full ISI reaches the top that the peek fades over

/**
 * Splits an authored ISI cell into a teal header (first heading becomes the
 * title) + a body wrapper holding the rest, and adds the +/− toggle.
 * @param {Element} cell the authored content cell
 * @param {'more'|'less'} mode toggle style
 * @param {string} href toggle anchor target
 * @returns {{header: HTMLElement, body: HTMLElement}}
 */
function buildParts(cell, mode, href) {
  // NB: use a <div>, not <header> — the global `header { height }` rule in
  // styles.css would otherwise force this bar to the page-header height.
  const header = document.createElement('div');
  header.className = 'isi-header';

  // Lift the first heading ("Important Safety Information") into the teal bar.
  const title = document.createElement('h2');
  title.className = 'isi-title';
  const firstHeading = cell.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > h4');
  title.textContent = firstHeading ? firstHeading.textContent.trim() : 'Important Safety Information';
  if (firstHeading) firstHeading.remove();

  const toggle = document.createElement('a');
  toggle.className = 'isi-toggle';
  toggle.href = href;
  const glyph = mode === 'less' ? '–' : '+'; // – / +
  const label = mode === 'less' ? 'LESS' : 'MORE';
  toggle.innerHTML = `<i class="isi-toggle-icon" aria-hidden="true">${glyph}</i><span class="isi-toggle-label">${label}</span>`;
  toggle.setAttribute('aria-label', mode === 'less'
    ? 'Collapse Important Safety Information'
    : 'Expand Important Safety Information');

  header.append(toggle, title);

  const body = document.createElement('div');
  body.className = 'isi-body';
  body.append(...cell.childNodes);

  return { header, body };
}

export default function decorate(block) {
  const rows = [...block.children];
  if (rows.length < 2) return;

  const peekCell = rows[0].firstElementChild || rows[0];
  const fullCell = rows[1].firstElementChild || rows[1];

  /* ── Full, in-flow ISI (Row 2) ─────────────────────────────── */
  const full = document.createElement('div');
  full.className = 'isi-full';
  full.id = FULL_ID;
  const fullParts = buildParts(fullCell, 'less', '#top');
  full.append(fullParts.header, fullParts.body);

  /* Replace the block's contents with just the full copy */
  block.textContent = '';
  block.append(full);

  /* ── Fixed peek banner (Row 1) ─────────────────────────────── */
  const peek = document.createElement('aside');
  peek.className = 'isi-peek';
  peek.setAttribute('aria-label', 'Important Safety Information');
  const peekParts = buildParts(peekCell, 'more', `#${FULL_ID}`);

  /* The peek shows only the abbreviated version (source parity): the intro
     paragraphs up to and including the WARNING box. Drop everything after the
     first blockquote so the bullet lists / closing headings don't appear. */
  const warning = peekParts.body.querySelector('blockquote');
  if (warning) {
    let node = warning.nextSibling;
    while (node) {
      const next = node.nextSibling;
      node.remove();
      node = next;
    }
  }

  peek.append(peekParts.header, peekParts.body);
  document.body.append(peek);

  /* MORE → smooth-scroll to the full ISI; LESS → scroll to top */
  peekParts.header.querySelector('.isi-toggle').addEventListener('click', (e) => {
    e.preventDefault();
    full.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  fullParts.header.querySelector('.isi-toggle').addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ── Peek visibility ─────────────────────────────────────────
     The peek banner is only shown while the full in-flow ISI is still entirely
     below the fold. As soon as the real ISI starts entering the viewport it is
     hidden, so the two copies are never on screen at the same time (the source
     shows the ISI content only once). A short fade over the last FADE_DISTANCE
     of the approach keeps the hand-off smooth. */
  const updatePeek = () => {
    ticking = false;
    const { top } = full.getBoundingClientRect();
    const vh = window.innerHeight;
    // distance from the viewport bottom to the top of the full ISI
    const distanceBelowFold = top - vh;
    if (distanceBelowFold <= 0) {
      // full ISI has entered the viewport — hide the peek entirely
      peek.style.opacity = '0';
      peek.style.visibility = 'hidden';
    } else {
      peek.style.visibility = 'visible';
      peek.style.opacity = distanceBelowFold < FADE_DISTANCE
        ? String(Math.max(0, distanceBelowFold / FADE_DISTANCE))
        : '1';
    }
  };
  let ticking = false;
  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(updatePeek);
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  updatePeek();
}
