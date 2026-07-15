/*
 * Embed Block
 * Show videos and social posts directly on your page
 * https://www.hlx.live/developer/block-collection/embed
 */
import { getYoutubeEmbedHtml, getVimeoEmbedHtml } from '../../scripts/utils.js';

// Embeds are trusted player iframes (YouTube/Vimeo/Brightcove); allow the iframe
// tag + its player attributes, which DOMPurify's default HTML profile strips.
const EMBED_SANITIZE = {
  ADD_TAGS: ['iframe'],
  ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'loading', 'title'],
};

const loadScript = (url, callback, type) => {
  const head = document.querySelector('head');
  const script = document.createElement('script');
  script.src = url;
  if (type) {
    script.setAttribute('type', type);
  }
  script.onload = callback;
  head.append(script);
  return script;
};

/* Add iframe wrapper to the embed */
const getDefaultEmbed = (url) => `<div class="iframe-wrapper">
    <iframe src="${url.href}" allowfullscreen=""
      scrolling="no" allow="encrypted-media" title="Content from ${url.hostname}" loading="lazy">
    </iframe>
  </div>`;

const embedTwitter = (url) => {
  if (!url.href.startsWith('https://twitter.com')) {
    url.href = url.href.replace('https://x.com', 'https://twitter.com');
  }
  const embedHTML = `<blockquote class="twitter-tweet"><a href="${url.href}"></a></blockquote>`;
  loadScript('https://platform.twitter.com/widgets.js');
  return embedHTML;
};

/* Parse a players.brightcove.net URL into account / player / videoId.
   Form: https://players.brightcove.net/{account}/{player}_default/index.html?videoId={id} */
const parseBrightcove = (url) => {
  const [account, playerSegment] = url.pathname.split('/').filter(Boolean);
  if (!account || !playerSegment) return null;
  const player = playerSegment.includes('_') ? playerSegment.slice(0, playerSegment.indexOf('_')) : playerSegment;
  const videoId = url.searchParams.get('videoId') || '';
  if (!player || !videoId) return null;
  return { account, player, videoId };
};

/* Brightcove: embed the player in-page (load its player script + render a
   <video-js> element) rather than via iframe, so the page's own CSS can style
   the controls (e.g. the big play button) to match the source. */
const embedBrightcove = (block, info, autoplay) => {
  const videoEl = document.createElement('video-js');
  videoEl.setAttribute('data-account', info.account);
  videoEl.setAttribute('data-player', info.player);
  videoEl.setAttribute('data-embed', 'default');
  videoEl.setAttribute('data-video-id', info.videoId);
  videoEl.setAttribute('controls', '');
  if (autoplay) videoEl.setAttribute('autoplay', '');
  videoEl.classList.add('vjs-fluid');
  block.append(videoEl);
  loadScript(
    `https://players.brightcove.net/${info.account}/${info.player}_default/index.min.js`,
    () => { if (window.bc) window.bc(videoEl); },
  );
};

const loadEmbed = (block, link, autoplay) => {
  if (block.classList.contains('embed-is-loaded')) {
    return;
  }

  const url = new URL(link);

  // Brightcove uses an in-page player (special-cased: it inserts a <video-js>
  // element and loads the player script, rather than returning embed HTML).
  const brightcove = link.includes('players.brightcove.net') ? parseBrightcove(url) : null;
  if (brightcove) {
    block.classList = 'block embed embed-brightcove';
    embedBrightcove(block, brightcove, autoplay);
    block.classList.add('embed-is-loaded');
    return;
  }

  const EMBEDS_CONFIG = [
    {
      match: ['youtube', 'youtu.be'],
      embed: (u, play) => getYoutubeEmbedHtml(u, play),
    },
    {
      match: ['vimeo'],
      embed: (u, play) => getVimeoEmbedHtml(u, play),
    },
    {
      match: ['twitter', 'x.com'],
      embed: embedTwitter,
    },
  ];
  const config = EMBEDS_CONFIG.find((e) => e.match.some((match) => link.includes(match)));
  if (config) {
    const embedHtml = config.embed(url, autoplay);
    block.innerHTML = (window.DOMPurify?.sanitize(embedHtml, EMBED_SANITIZE))
      ?? embedHtml;
    block.classList = `block embed embed-${config.match[0]}`;
  } else {
    const defaultHtml = getDefaultEmbed(url);
    block.innerHTML = (window.DOMPurify?.sanitize(defaultHtml, EMBED_SANITIZE))
      ?? defaultHtml;
    block.classList = 'block embed';
  }
  block.classList.add('embed-is-loaded');
};

export default function decorate(block) {
  const placeholder = block.querySelector('picture');
  const link = block.querySelector('a').href;
  block.textContent = '';

  if (placeholder) {
    const wrapper = document.createElement('div');
    wrapper.className = 'embed-placeholder';
    const placeholderHtml = '<div class="embed-placeholder-play"><button type="button" title="Play"></button></div>';
    wrapper.innerHTML = (window.DOMPurify?.sanitize(placeholderHtml, EMBED_SANITIZE))
      ?? placeholderHtml;
    wrapper.prepend(placeholder);
    wrapper.addEventListener('click', () => {
      loadEmbed(block, link, true);
    });
    block.append(wrapper);
  } else {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        observer.disconnect();
        loadEmbed(block, link);
      }
    });
    observer.observe(block);
  }
}
