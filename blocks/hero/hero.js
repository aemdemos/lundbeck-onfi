import { buildPictureContentFromImageCell } from '../../scripts/utils.js';

function applyAccentColor(block) {
  block.querySelectorAll('h1 strong, h2 strong, h3 strong, p strong').forEach((strong) => {
    const span = document.createElement('span');
    span.className = 'accent-color';
    span.textContent = strong.textContent;
    strong.replaceWith(span);
  });
}

function decorateSinglePanel(block) {
  block.classList.add('single');
  applyAccentColor(block);

  const contentDiv = block.querySelector(':scope > div:last-child');
  const lastP = contentDiv?.querySelector(':scope > div > p:last-child');
  if (lastP && lastP.textContent.trim().toLowerCase() === 'actor portrayal') {
    lastP.classList.add('actor-portrayal');
    block.appendChild(lastP);
  }
}

function decorateDualPanel(block, rows) {
  const panels = [];

  rows.forEach((row, index) => {
    const cells = [...row.children];
    const panel = document.createElement('div');
    panel.className = `hero-panel hero-panel-${index === 0 ? 'dark' : 'light'}`;

    // First cell: image (background)
    const imgCell = cells[0];
    if (imgCell) {
      const bgDiv = document.createElement('div');
      bgDiv.className = 'hero-panel-bg';
      const bgContent = buildPictureContentFromImageCell(imgCell);
      imgCell.replaceChildren();
      bgDiv.append(bgContent);
      panel.appendChild(bgDiv);
    }

    // Second cell: text content overlay
    const textCell = cells[1];
    if (textCell) {
      const contentDiv = document.createElement('div');
      contentDiv.className = 'hero-panel-content';
      contentDiv.append(...textCell.childNodes);

      // Move "Actor portrayal" to panel level for absolute positioning
      const allP = contentDiv.querySelectorAll('p');
      allP.forEach((p) => {
        if (p.textContent.trim().toLowerCase() === 'actor portrayal') {
          p.classList.add('actor-portrayal');
          panel.appendChild(p);
        }
      });

      // CTA row: sole link in a paragraph — matches vyepti split-banner absolute CTA band
      contentDiv.querySelectorAll('p').forEach((p) => {
        const a = p.querySelector(':scope > a[href]');
        if (a && p.childElementCount === 1 && p.firstElementChild === a) {
          p.classList.add('hero-panel-cta-wrap');
        }
      });

      // Group headline/body copy for vyepti-style margin-left/right at wide breakpoints
      const toWrap = [...contentDiv.children].filter(
        (el) => !el.classList.contains('hero-panel-cta-wrap'),
      );
      if (toWrap.length) {
        const desc = document.createElement('div');
        desc.className = 'hero-panel-description';
        toWrap.forEach((el) => desc.append(el));
        contentDiv.prepend(desc);
      }

      panel.appendChild(contentDiv);
    }

    panels.push(panel);
  });

  block.textContent = '';
  const wrapper = document.createElement('div');
  wrapper.className = 'hero-panels';
  panels.forEach((p) => wrapper.appendChild(p));
  block.appendChild(wrapper);

  applyAccentColor(block);
}

/**
 * Onfi homepage hero (.hero.home): a translucent overlay panel anchored to the
 * left of a full-width section background photo. The panel holds the
 * "Don't Give Up" logo, the intro copy and an inline "GO »" link. The
 * background photo is supplied by the section-metadata `background-image`
 * (decorated into a sibling `.bg-image` layer by scripts.js), so this block
 * only owns the panel content.
 *
 * decorateMain() wraps the bare logo `<img>` together with the following intro
 * `<p>` inside a single outer `<p>`; this normalises that back into a standalone
 * `<picture>` followed by the intro paragraph so the CSS contract is simple.
 * @param {Element} block
 */
function decorateHomePanel(block) {
  const row = block.querySelector(':scope > div');
  if (!row) return;
  const cells = [...row.children];
  const cell = cells[0];
  if (!cell) return;

  // First cell = the left translucent panel (logo + intro + GO).
  cell.classList.add('hero-home-panel');

  // Unwrap the image-in-paragraph mangling: hoist any <picture>/<img> that
  // decorateMain() nested inside a <p> back up to the cell, before the copy.
  const picture = cell.querySelector('picture, img');
  const panelPicture = picture ? (picture.closest('picture') || picture) : null;
  if (panelPicture) {
    panelPicture.classList.add('hero-home-logo');
    cell.prepend(panelPicture);
  }

  // Drop any now-empty <p> shells left behind by hoisting the image out.
  cell.querySelectorAll(':scope > p').forEach((p) => {
    if (!p.textContent.trim() && !p.querySelector('img, picture')) p.remove();
  });

  // Second cell (optional) = the savings copy. On desktop it overlays the
  // right side of the photo; on mobile it stacks below the panel in the teal
  // band. Tag it so the CSS can position it independently of the left panel.
  const savingsCell = cells[1];
  if (savingsCell) savingsCell.classList.add('hero-home-savings');
}

/**
 * Section-metadata styles single-light / single-dark force the single full-bleed
 * panel layout regardless of how the hero cells are authored.
 * @param {Element} block
 * @returns {boolean} true if a single-* section style is present
 */
function hasSingleSectionStyle(block) {
  const section = block.closest('.section');
  return !!section && (section.classList.contains('single-light')
    || section.classList.contains('single-dark'));
}

/**
 * Flattens an authored [image cell, text cell] row into sibling rows, each
 * wrapping its original cell, so decorateSinglePanel's DOM contract
 * (row > cell > content) holds and instrumentation on cells is preserved.
 * @param {Element} block
 */
function flattenToSinglePanelRows(block) {
  const cells = [...block.children].flatMap((row) => [...row.children]);
  if (cells.length < 2) return;
  block.textContent = '';
  cells.forEach((cell) => {
    const row = document.createElement('div');
    row.append(cell);
    block.append(row);
  });
}

/**
 * Collapses the multiple responsive &lt;picture&gt; variants in the image row into a
 * single art-direction &lt;picture&gt; (swaps asset per viewport), matching the
 * dual-panel behaviour. Without this only the first picture is ever shown.
 * @param {Element} block
 */
function consolidateSinglePanelImage(block) {
  const imageRow = block.querySelector(':scope > div:first-child');
  const imageCell = imageRow?.firstElementChild;
  if (!imageCell) return;
  const built = buildPictureContentFromImageCell(imageCell);
  imageCell.replaceChildren(built);
}

export default function decorate(block) {
  const rows = [...block.children];

  // Onfi homepage hero — translucent overlay panel over a section bg photo
  if (block.classList.contains('home')) {
    decorateHomePanel(block);
    return;
  }

  // Section style single-light / single-dark always renders as a single panel
  if (hasSingleSectionStyle(block)) {
    const isMultiCell = rows.some((row) => row.children.length >= 2);
    if (isMultiCell) flattenToSinglePanelRows(block);
    consolidateSinglePanelImage(block);
    decorateSinglePanel(block);
    return;
  }

  // Detect mode: if any row has 2 cells (image + text), it's dual-panel
  const isDual = rows.some((row) => row.children.length >= 2);

  if (!isDual) {
    decorateSinglePanel(block);
    return;
  }

  // Dual-panel: each row has [image cell, text cell]
  decorateDualPanel(block, rows);
}
