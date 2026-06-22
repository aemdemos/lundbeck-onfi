export default function decorate(block) {
  if (block.querySelector('button')) return;

  const SHOW_AFTER = 120;

  block.textContent = '';

  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-label', 'Back to top');

  button.addEventListener('click', () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  });

  const toggle = () => {
    button.classList.toggle('visible', window.scrollY > SHOW_AFTER);
  };

  block.append(button);
  toggle();
  window.addEventListener('scroll', toggle, { passive: true });
}
