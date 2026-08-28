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
      if (!col.querySelector('picture')) return;
      // merges adjacent-image runs into art-direction pictures; other content stays put
      col.replaceChildren(buildPictureContentFromImageCell(col));
      if (col.children.length === 1) {
        // picture (single or merged art-direction) is the only content in column
        col.classList.add('columns-img-col');
      }
    });
  });

  // resource-list: flag links whose icon trails the label so CSS can push it to
  // the right edge (a text-node label makes :last-child unreliable in CSS)
  if (block.classList.contains('resource-list')) {
    block.querySelectorAll('a').forEach((link) => {
      const icon = link.querySelector('.icon');
      if (icon && link.lastChild === icon) link.classList.add('icon-trailing');
    });
  }
}
