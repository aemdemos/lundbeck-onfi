import { loadFragment } from '../fragment/fragment.js';
import {
  buildBlock, decorateBlock, loadBlock, loadCSS,
} from '../../scripts/aem.js';

/*
  This is not a traditional block, so there is no decorate function.
  Instead, links to a /modals/ path are automatically transformed into a modal.
  Other blocks can also use the createModal() and openModal() functions.
*/

export async function createModal(contentNodes) {
  await loadCSS(`${window.hlx.codeBasePath}/blocks/modal/modal.css`);
  const dialog = document.createElement('dialog');
  const dialogContent = document.createElement('div');
  dialogContent.classList.add('modal-content');
  dialogContent.append(...contentNodes);
  dialog.append(dialogContent);

  const closeButton = document.createElement('button');
  closeButton.classList.add('close-button');
  closeButton.setAttribute('aria-label', 'Close');
  closeButton.type = 'button';
  const closeIcon = document.createElement('span');
  closeIcon.className = 'icon icon-close';
  closeButton.appendChild(closeIcon);
  closeButton.addEventListener('click', () => dialog.close());
  dialog.prepend(closeButton);

  const block = buildBlock('modal', '');
  document.querySelector('main').append(block);
  decorateBlock(block);
  await loadBlock(block);

  // close on click outside the dialog
  dialog.addEventListener('click', (e) => {
    const {
      left, right, top, bottom,
    } = dialog.getBoundingClientRect();
    const { clientX, clientY } = e;
    if (clientX < left || clientX > right || clientY < top || clientY > bottom) {
      dialog.close();
    }
  });

  dialog.addEventListener('close', () => {
    document.body.classList.remove('modal-open');
    block.remove();
  });

  block.innerHTML = '';
  block.append(dialog);

  return {
    block,
    showModal: () => {
      dialog.showModal();
      // reset scroll position
      setTimeout(() => { dialogContent.scrollTop = 0; }, 0);
      document.body.classList.add('modal-open');
    },
  };
}

export async function openModal(fragmentUrl, targetUrl) {
  const path = fragmentUrl.startsWith('http')
    ? new URL(fragmentUrl, window.location).pathname
    : fragmentUrl;

  const fragment = await loadFragment(path);
  const { block, showModal } = await createModal(fragment.childNodes);
  // interstitial: wire the Ok/Cancel actions to the outgoing link
  if (targetUrl) {
    block.classList.add('exit');
    const dialog = block.querySelector('dialog');
    const actionWrappers = [];
    block.querySelectorAll('.modal-content a').forEach((a) => {
      const label = (a.title || a.textContent).trim().toLowerCase();
    //  a.classList.remove('primary', 'secondary', 'accent');
      if (label === 'ok') {
        a.classList.add('ok');
        a.href = targetUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.addEventListener('click', () => dialog.close());
        actionWrappers.push(a.closest('.button-wrapper') || a);
      } else if (label === 'cancel') {
        a.classList.add('cancel');
        a.addEventListener('click', (e) => {
          e.preventDefault();
          dialog.close();
        });
        actionWrappers.push(a.closest('.button-wrapper') || a);
      }
    });

    // group Ok/Cancel into a centered action row
    if (actionWrappers.length) {
      const actions = document.createElement('div');
      actions.className = 'modal-actions';
      actionWrappers[0].before(actions);
      actions.append(...actionWrappers);
    }
  }
  showModal();
}
