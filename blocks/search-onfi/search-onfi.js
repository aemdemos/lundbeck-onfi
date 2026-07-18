/**
 * Builds a site-search form: a text input (name="q") that GETs /search.
 * Reused both as the header's expandable search and as a standalone block
 * authored directly in a page (e.g. the /search results page).
 * @param {Element} block The search-onfi block element
 */
export default function decorate(block) {
  const form = document.createElement('form');
  form.className = 'search-onfi-form';
  form.action = '/search';
  form.method = 'GET';

  const input = document.createElement('input');
  input.className = 'search-onfi-input';
  input.type = 'text';
  input.name = 'q';
  input.setAttribute('aria-label', 'Search');

  const query = new URLSearchParams(window.location.search).get('q');
  if (query) input.value = query;

  const submit = document.createElement('button');
  submit.className = 'search-onfi-submit';
  submit.type = 'submit';
  submit.textContent = 'GO';

  form.append(input, submit);
  block.textContent = '';
  block.append(form);
}
