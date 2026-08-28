/* ==========================================================================
   Entry — mounts DOM, boots WebGL, orchestrates GSAP animations.
   ========================================================================== */

import './style.css';

import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { renderApp } from './dom.js';
import { createWebGLScene } from './webgl.js';
import {
  initCharReveals,
  initTilt,
  flipInCards,
  initSectionWipes,
  initMagnetic,
  initParallax,
  initServicesPin,
  initKineticWord,
  initCustomCursor,
  drawLoaderLogo,
  playCurtainReveal,
  initScrollVelocity,
  onSectionEnter,
} from './animations.js';

gsap.registerPlugin(ScrollTrigger);

// ---------- Boot -------------------------------------------------------------
const app = document.getElementById('app');
renderApp(app);

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Loader -----------------------------------------------------------
const loader = document.getElementById('page-loader');
const loaderFill = document.getElementById('loader-fill');
const loaderPct = document.getElementById('loader-pct');

const loadState = { pct: 0, ready: false, fontsReady: false, sceneReady: false };

function updateLoaderUI() {
  if (!loaderFill || !loaderPct) return;
  loaderFill.style.width = `${loadState.pct}%`;
  loaderPct.textContent = `${Math.floor(loadState.pct)}%`;
}

// Draw the T logo before the progress bar starts.
if (!reduceMotion) drawLoaderLogo();

// Fake progress that eases up to 90% while we wait for real signals.
function tickLoader() {
  if (loadState.ready) return;
  const target = (loadState.fontsReady && loadState.sceneReady) ? 100 : 90;
  loadState.pct += (target - loadState.pct) * 0.06;
  updateLoaderUI();
  if (loadState.pct >= 99.5 && loadState.fontsReady && loadState.sceneReady) {
    loadState.pct = 100;
    updateLoaderUI();
    hideLoader();
    return;
  }
  requestAnimationFrame(tickLoader);
}
tickLoader();

function hideLoader() {
  if (loadState.ready) return;
  loadState.ready = true;
  document.body.classList.remove('is-loading');
  document.body.classList.add('js-loaded');
  if (loader) {
    gsap.to(loader, {
      opacity: 0,
      duration: 0.6,
      ease: 'power2.out',
      onComplete: () => loader.remove(),
    });
  }
  // Fire the curtain reveal in parallel with loader fade.
  if (!reduceMotion) playCurtainReveal();
  // Run intro timeline once the loader starts fading
  playIntro();
}

if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => {
    loadState.fontsReady = true;
    // Layout may shift once web fonts swap in — refresh ScrollTrigger so
    // every trigger's start/end position is recomputed against the final
    // layout. Without this, later sections can end up with stale positions
    // and their reveals never fire.
    ScrollTrigger.refresh();
  });
} else {
  setTimeout(() => {
    loadState.fontsReady = true;
    ScrollTrigger.refresh();
  }, 400);
}
// Also refresh after full window load (all images / iframes settled).
window.addEventListener('load', () => ScrollTrigger.refresh());

// ---------- WebGL ------------------------------------------------------------
const canvas = document.getElementById('webgl');
let webgl = null;

if (canvas && !reduceMotion) {
  try {
    webgl = createWebGLScene({
      canvas,
      onReady: () => { loadState.sceneReady = true; },
    });
  } catch (err) {
    console.warn('WebGL scene failed to init — continuing without 3D.', err);
    loadState.sceneReady = true;
  }
} else {
  loadState.sceneReady = true;
}
// Failsafe: never leave the loader / curtain covering the page. If WebGL
// hasn't signaled readiness after 3s, force the loader forward so the
// hero becomes visible regardless.
setTimeout(() => { loadState.sceneReady = true; }, 3000);

// ---------- Smooth scroll (Lenis) --------------------------------------------
const lenis = new Lenis({
  duration: 1.15,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
  smoothTouch: false,
});

lenis.on('scroll', () => ScrollTrigger.update());
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

// Smooth anchor scrolling
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const href = a.getAttribute('href');
    if (!href || href.length <= 1) return;
    const target = document.querySelector(href);
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: -64, duration: 1.2 });
  });
});

// ---------- Intro timeline ---------------------------------------------------
function playIntro() {
  if (reduceMotion) return;

  const words = document.querySelectorAll('.hero__title .split-word');
  const meta = document.querySelector('[data-hero-meta]');
  const lede = document.querySelector('[data-hero-lede]');
  const actions = document.querySelector('[data-hero-actions]');

  gsap.set(words, { yPercent: 110 });
  gsap.set([meta, lede, actions], { opacity: 0, y: 20 });

  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.to(meta, { opacity: 1, y: 0, duration: 0.9 }, 0.5)
    .to(words, {
      yPercent: 0,
      duration: 1.2,
      stagger: 0.08,
    }, '-=0.6')
    .to(lede, { opacity: 1, y: 0, duration: 0.9 }, '-=0.6')
    .to(actions, { opacity: 1, y: 0, duration: 0.8 }, '-=0.5');
}

// ---------- Scroll-driven WebGL progress + velocity --------------------------
if (webgl) {
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => webgl.setProgress(self.progress),
  });
  initScrollVelocity((v) => webgl.setVelocity && webgl.setVelocity(v));
  onSectionEnter((name) => {
    if (webgl.burst) webgl.burst(name);
  });
}

// Scroll progress bar
const progressEl = document.querySelector('.scroll-progress');
if (progressEl) {
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      progressEl.style.setProperty('--p', self.progress.toFixed(4));
    },
  });
}

// Nav scrolled state
const nav = document.querySelector('[data-nav]');
if (nav) {
  ScrollTrigger.create({
    start: 100,
    end: 'max',
    onToggle: (self) => nav.classList.toggle('is-scrolled', self.isActive),
  });
}

// ---------- Section reveals --------------------------------------------------
// Eyebrow + lead animate as before; the title itself is handled by
// initCharReveals below (per-char rise+fade+rotate).
gsap.utils.toArray('[data-section]').forEach((section) => {
  if (section.dataset.section === 'hero') return;

  const eyebrow = section.querySelector('.section__eyebrow');
  const lead = section.querySelector('.section__lead');

  const targets = [eyebrow, lead].filter(Boolean);
  if (!targets.length) return;

  gsap.from(targets, {
    y: 40,
    opacity: 0,
    duration: 0.9,
    ease: 'power3.out',
    stagger: 0.1,
    scrollTrigger: {
      trigger: section,
      start: 'top 78%',
    },
  });
});

// ---------- Char-reveal all section titles -----------------------------------
if (!reduceMotion) initCharReveals();

// ---------- Cards / grids: staggered / flip-in enter -------------------------
function staggerReveal(selector, opts = {}) {
  const items = gsap.utils.toArray(selector);
  if (!items.length) return;
  gsap.from(items, {
    y: 60,
    opacity: 0,
    duration: 0.9,
    ease: 'power3.out',
    stagger: opts.stagger || 0.09,
    scrollTrigger: {
      trigger: items[0].parentElement,
      start: opts.start || 'top 82%',
    },
  });
}

if (!reduceMotion) {
  // Cards get the fancier flip-in
  flipInCards('[data-tilt]',     { stagger: 0.09 });
  flipInCards('[data-industry]', { stagger: 0.09 });
  flipInCards('[data-pillar]',   { stagger: 0.08 });
  flipInCards('[data-platform]', { stagger: 0.06 });
  // Services rows are revealed via the pinned timeline on desktop.
  // On mobile we fall back to a simple stagger (see matchMedia below).
} else {
  staggerReveal('[data-tilt]');
  staggerReveal('[data-service]', { stagger: 0.07 });
  staggerReveal('[data-industry]');
  staggerReveal('[data-platform]', { stagger: 0.06 });
  staggerReveal('[data-pillar]', { stagger: 0.08 });
}

// ---------- Audience card mouse spotlight (kept, plus tilt) ------------------
// spotlight is now driven inside initTilt via --mx/--my
if (!reduceMotion) {
  initTilt('[data-tilt]',     { strength: 8 });
  initTilt('[data-industry]', { strength: 6 });
  initTilt('[data-pillar]',   { strength: 5 });
} else {
  // Preserve original pointer-driven spotlight even under reduced motion
  document.querySelectorAll('[data-tilt]').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
      card.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
    });
  });
}

// ---------- Number counter ---------------------------------------------------
document.querySelectorAll('.stats__num').forEach((el) => {
  const to = parseInt(el.dataset.count, 10) || 0;
  const valEl = el.querySelector('.stats__num-value');
  if (!valEl) return;
  const state = { v: 0 };
  gsap.to(state, {
    v: to,
    duration: 1.6,
    ease: 'power2.out',
    scrollTrigger: {
      trigger: el,
      start: 'top 85%',
    },
    onUpdate: () => {
      valEl.textContent = Math.round(state.v);
    },
  });
});

// ---------- Marquee ----------------------------------------------------------
const marquee = document.querySelector('[data-marquee]');
if (marquee && !reduceMotion) {
  gsap.set(marquee, { xPercent: 0 });
  gsap.to(marquee, {
    xPercent: -50,
    duration: 30,
    ease: 'none',
    repeat: -1,
  });
}

// Kinetic word inside the marquee — reacts to scroll velocity
if (!reduceMotion) initKineticWord();

// ---------- Testimonials horizontal drag hint --------------------------------
const testTrack = document.querySelector('[data-testimonials]');
if (testTrack) {
  let down = false, startX = 0, scrollLeft = 0;
  testTrack.addEventListener('pointerdown', (e) => {
    down = true;
    startX = e.pageX;
    scrollLeft = testTrack.scrollLeft;
    testTrack.setPointerCapture(e.pointerId);
  });
  testTrack.addEventListener('pointermove', (e) => {
    if (!down) return;
    testTrack.scrollLeft = scrollLeft - (e.pageX - startX);
  });
  const release = (e) => {
    down = false;
    try { testTrack.releasePointerCapture(e.pointerId); } catch {}
  };
  testTrack.addEventListener('pointerup', release);
  testTrack.addEventListener('pointercancel', release);
  testTrack.addEventListener('pointerleave', release);
}

// ---------- CTA reveal -------------------------------------------------------
gsap.from('[data-cta]', {
  scale: 0.95,
  y: 60,
  opacity: 0,
  duration: 1.1,
  ease: 'power3.out',
  scrollTrigger: {
    trigger: '[data-cta]',
    start: 'top 82%',
  },
});

// ---------- Extra motion layers ---------------------------------------------
if (!reduceMotion) {
  // initSectionWipes(); // Colored section-load wipe panels removed by request.
  initMagnetic('[data-magnetic]', 110, 0.32);
  initParallax();
  initServicesPin();
  initCustomCursor();
}

// ---------- MatchMedia downgrade for touch/mobile ----------------------------
const mm = gsap.matchMedia();
mm.add('(max-width: 48rem)', () => {
  return () => {};
});

// ---------- Cleanup on unload -----------------------------------------------
window.addEventListener('beforeunload', () => {
  ScrollTrigger.killAll();
  if (webgl) webgl.dispose();
});
