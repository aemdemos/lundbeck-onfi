/*
 * Video Block
 * Show a video referenced by a link
 * https://www.hlx.live/developer/block-collection/video
 */

import { ensureDOMPurify } from '../../scripts/scripts.js';
import { getYoutubeEmbedHtml, getVimeoEmbedHtml, parseBrightcoveUrl } from '../../scripts/utils.js';

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Cache the Brightcove player <script> load per account/player so multiple video
// blocks on a page share a single loader promise.
const brightcoveLoaders = new Map();

function loadBrightcovePlayer(account, player) {
  const key = `${account}/${player}`;
  if (!brightcoveLoaders.has(key)) {
    brightcoveLoaders.set(key, new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://players.brightcove.net/${account}/${player}_default/index.min.js`;
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.append(script);
    }));
  }
  return brightcoveLoaders.get(key);
}

// Embeds the Brightcove player in-page (as a <video-js> element) so the page can
// style its controls (e.g. the big play button) to match the source design — an
// iframe embed keeps the player's default green button in a cross-origin frame.
async function loadBrightcoveEmbed(block, info, autoplay) {
  const videoEl = document.createElement('video-js');
  videoEl.setAttribute('data-account', info.account);
  videoEl.setAttribute('data-player', info.player);
  videoEl.setAttribute('data-embed', info.embed);
  videoEl.setAttribute('data-video-id', info.videoId);
  videoEl.setAttribute('controls', '');
  if (autoplay) videoEl.setAttribute('autoplay', '');
  videoEl.classList.add('vjs-fluid');
  block.append(videoEl);
  await loadBrightcovePlayer(info.account, info.player);
  if (window.bc) window.bc(videoEl);
  block.dataset.embedLoaded = true;
}

// Video embeds are trusted iframe players (YouTube/Vimeo/Brightcove); allow the iframe
// tag and its player attributes, which the default HTML profile strips.
const EMBED_SANITIZE = {
  ADD_TAGS: ['iframe'],
  ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'loading', 'title'],
};

async function htmlToElement(html) {
  await ensureDOMPurify();
  const temp = document.createElement('div');
  temp.innerHTML = window.DOMPurify.sanitize(html, EMBED_SANITIZE);
  return temp.firstElementChild;
}

function getVideoElement(source, autoplay, background) {
  const video = document.createElement('video');
  video.setAttribute('controls', '');
  if (autoplay) video.setAttribute('autoplay', '');
  if (background) {
    video.setAttribute('loop', '');
    video.setAttribute('playsinline', '');
    video.removeAttribute('controls');
    video.addEventListener('canplay', () => {
      video.muted = true;
      if (autoplay) video.play();
    });
  }

  const sourceEl = document.createElement('source');
  sourceEl.setAttribute('src', source);
  sourceEl.setAttribute('type', `video/${source.split('.').pop()}`);
  video.append(sourceEl);

  return video;
}

const loadVideoEmbed = async (block, link, autoplay, background) => {
  if (block.dataset.embedLoaded === 'true') {
    return;
  }
  const url = new URL(link);

  const isYoutube = link.includes('youtube') || link.includes('youtu.be');
  const isVimeo = link.includes('vimeo');
  const brightcove = link.includes('players.brightcove.net') ? parseBrightcoveUrl(url) : null;

  if (isYoutube) {
    const embedWrapper = await htmlToElement(getYoutubeEmbedHtml(url, autoplay, background));
    block.append(embedWrapper);
    embedWrapper.querySelector('iframe').addEventListener('load', () => {
      block.dataset.embedLoaded = true;
    });
  } else if (brightcove) {
    await loadBrightcoveEmbed(block, brightcove, autoplay);
  } else if (isVimeo) {
    const embedWrapper = await htmlToElement(getVimeoEmbedHtml(url, autoplay, background));
    block.append(embedWrapper);
    embedWrapper.querySelector('iframe').addEventListener('load', () => {
      block.dataset.embedLoaded = true;
    });
  } else {
    const videoEl = getVideoElement(link, autoplay, background);
    block.append(videoEl);
    videoEl.addEventListener('canplay', () => {
      block.dataset.embedLoaded = true;
    });
  }
};

export default async function decorate(block) {
  const placeholder = block.querySelector('picture');
  const link = block.querySelector('a').href;
  block.textContent = '';
  block.dataset.embedLoaded = false;

  const autoplay = block.classList.contains('autoplay');
  if (placeholder) {
    block.classList.add('placeholder');
    const wrapper = document.createElement('div');
    wrapper.className = 'video-placeholder';
    wrapper.append(placeholder);

    if (!autoplay) {
      wrapper.insertAdjacentHTML(
        'beforeend',
        '<div class="video-placeholder-play"><button type="button" title="Play"></button></div>',
      );
      wrapper.addEventListener('click', () => {
        wrapper.remove();
        loadVideoEmbed(block, link, true, false);
      });
    }
    block.append(wrapper);
  }

  if (!placeholder || autoplay) {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        observer.disconnect();
        const playOnLoad = autoplay && !prefersReducedMotion.matches;
        loadVideoEmbed(block, link, playOnLoad, autoplay);
      }
    });
    observer.observe(block);
  }
}
