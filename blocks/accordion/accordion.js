import { moveInstrumentation } from '../../scripts/scripts.js';

export default function decorate(block) {
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    li.className = 'accordion-item';
    moveInstrumentation(row, li);
    while (row.firstElementChild) li.append(row.firstElementChild);

    const [label, body] = [...li.children];
    if (label !== null && label !== undefined) {
      label.className = 'accordion-item-label';

      // Convention: author bolds the lead phrase; the remaining inline content
      // becomes the "detail", which is collapsed on mobile and revealed on tablet up.
      const labelText = label.querySelector('p') || label;
      const lead = labelText.querySelector(':scope > strong, :scope > b');
      if (lead && lead.nextSibling) {
        const detail = document.createElement('span');
        detail.className = 'accordion-item-label-detail';
        let node = lead.nextSibling;
        while (node) {
          const next = node.nextSibling;
          detail.append(node);
          node = next;
        }
        if (detail.textContent.trim()) labelText.append(detail);
      }
    }
    if (body !== null && body !== undefined) body.className = 'accordion-item-body';

    // The whole card toggles the item; clicks inside the open body are ignored
    // so links stay clickable and body text stays selectable.
    li.addEventListener('click', (e) => {
      if (body && body.contains(e.target)) return;
      li.classList.toggle('active');
    });

    ul.append(li);
  });

  block.textContent = '';
  block.append(ul);
}
