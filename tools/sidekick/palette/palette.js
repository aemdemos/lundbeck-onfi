/* eslint-disable import/no-unresolved */
/* this was originally for picking color values but was adapted to insert any CSS class name.
 * from the style-variables sheet in authoring. See docs/span-tags.md and docs/cell-class.md for more info. */
import { LitElement, html, css } from 'https://da.live/deps/lit/lit-all.min.js';
import DA_SDK from 'https://da.live/nx/utils/sdk.js';

const DEFAULT_COLORS_ENDPOINT = '/docs/library/style-variables.json';
const DEFAULT_PAGE_SIZE = 255;

function getPaletteConfig() {
  const params = new URLSearchParams(window.location.search);
  return {
    endpoint: params.get('palettePath') || DEFAULT_COLORS_ENDPOINT,
    sheet: params.get('sheet') || undefined,
  };
}

async function getPalette() {
  const { endpoint, sheet } = getPaletteConfig();
  const rows = [];

  for (
    let offset = 0, total = Infinity;
    offset < total;
    offset += DEFAULT_PAGE_SIZE
  ) {
    const qs = new URLSearchParams({
      offset: String(offset),
      limit: String(DEFAULT_PAGE_SIZE),
    });
    if (sheet) qs.append('sheet', sheet);

    const resp = await fetch(`${endpoint}?${qs.toString()}`);
    if (!resp.ok) return rows;

    const json = await resp.json();
    total = Number.isFinite(json.total)
      ? json.total
      : rows.length + (json.data?.length || 0);
    if (Array.isArray(json.data)) rows.push(...json.data);
    if (!Array.isArray(json.data) || json.data.length === 0) break;
  }

  return rows;
}

class PaletteElement extends LitElement {
  static properties = {
    palette: { type: Array },
    searchTerm: { type: String },
  };

  static styles = css`
    ul {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      gap: 1rem;
    }

    li {
      cursor: pointer;
      padding: 1rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      transition: all 0.2s ease;
      display: grid;
      grid-template-columns: 10px auto;
      gap: 10px;
      font-family: 'Adobe Clean', adobe-clean, 'Trebuchet MS', sans-serif;
    }

    li:hover {
      transform: translateY(-2px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .swatch {
      width: 100%;
      height: 70px;
      border-radius: 4px;
    }

    .label p {
      margin: 0.25rem 0;
    }

    .value {
      font-family: monospace;
      color: #666;
    }

    .filtered {
      display: none;
    }
  `;

  constructor() {
    super();
    this.palette = [];
    this.searchTerm = '';
  }

  handleSearch(e) {
    this.searchTerm = e.target.value.toLowerCase();
    this.requestUpdate();
  }

  connectedCallback() {
    super.connectedCallback();
    this.initPalette();
    const searchInput = document.getElementById('search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.handleSearch(e));
    }
  }

  async handleItemClick(brandName) {
    this.brandName = brandName;
    const { actions } = await DA_SDK;
    if (actions?.sendText) {
      actions.sendText(brandName);
      actions.closeLibrary();
    }
  }

  async initPalette() {
    const palette = await getPalette();
    if (!palette) return;
    this.palette = palette;
  }

  render() {
    return html`
      <ul>
        ${this.palette.map((color) => {
          const brandName = color['variable-name'];
          const colorValue = color['variable-style'];
          const uses = color.application;
          const isMatch =
            !this.searchTerm ||
            brandName.toLowerCase().includes(this.searchTerm) ||
            colorValue.toLowerCase().includes(this.searchTerm) ||
            (uses && uses.toLowerCase().includes(this.searchTerm));

          return html`
            <li
              class=${isMatch ? brandName : `${brandName} filtered`}
              data-color=${colorValue}
              data-name=${brandName}
              @click=${() => this.handleItemClick(brandName)}
            >
              <div class="swatch" style="background: ${colorValue};"></div>
              <div class="label">
                <p><strong>${brandName}</strong></p>
                <p>Uses: ${uses}</p>
                <p class="value">${colorValue}</p>
              </div>
            </li>
          `;
        })}
      </ul>
    `;
  }
}

customElements.define('palette-element', PaletteElement);
