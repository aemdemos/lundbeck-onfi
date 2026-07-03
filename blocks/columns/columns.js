import { getBlockId } from '../../scripts/scripts.js';
import { decorateCellClass } from '../../scripts/utils.js';

export default function decorate(block) {
  decorateCellClass(block);

  const blockId = getBlockId('columns');
  block.setAttribute('id', blockId);
  block.setAttribute('aria-label', `columns-${blockId}`);
  block.setAttribute('role', 'region');
  block.setAttribute('aria-roledescription', 'Columns');

  const cols = [...block.firstElementChild.children];
  block.classList.add(`columns-${cols.length}-cols`);

  // setup image columns
  [...block.children].forEach((row) => {
    [...row.children].forEach((col) => {
      const pic = col.querySelector('picture');
      if (pic) {
        const picWrapper = pic.closest('div');
        if (picWrapper && picWrapper.children.length === 1) {
          // picture is only content in column
          picWrapper.classList.add('columns-img-col');
        }
      }
    });
  });

  // Cards use per-line <br>s for the desktop layout; on mobile those breaks are
  // hidden so the copy reflows as prose. Guarantee a space after every <br> so words
  // never run together when the break is hidden, regardless of authored whitespace.
  block.querySelectorAll('br').forEach((br) => {
    const next = br.nextSibling;
    const hasLeadingSpace = next && next.nodeType === Node.TEXT_NODE && /^\s/.test(next.textContent);
    if (!hasLeadingSpace) br.after(document.createTextNode(' '));
  });
}
