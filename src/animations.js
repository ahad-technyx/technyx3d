/* ==========================================================================
   animations.js — bonus animation layer on top of main.js.
   Everything here is additive and can be dropped without breaking the
   baseline experience. All entry points are gated by a reduceMotion flag
   passed in from main.js.
   ========================================================================== */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/* --------------------------------------------------------------------------
   Utility: manual character splitter. Wraps every non-space char of an
   element's text in a <span class="split-char"><span>char</span></span>
   with the outer span acting as an overflow mask.
   -------------------------------------------------------------------------- */
export function splitChars(el) {
  if (!el || el.dataset.splitDone === '1') return [];
  const nodes = [];
  const walk = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      if (!text.trim()) return;
      const frag = document.createDocumentFragment();
      for (const ch of text) {
        if (ch === ' ') {
          frag.appendChild(document.createTextNode(' '));
        } else {
          const mask = document.createElement('span');
          mask.className = 'split-char';
          const inner = document.createElement('span');
          inner.className = 'split-char__inner';
          inner.textContent = ch;
          mask.appendChild(inner);
          frag.appendChild(mask);
          nodes.push(inner);
        }
      }
      node.parentNode.replaceChild(frag, node);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // Skip elements we already split or that should stay atomic
      if (node.classList && node.classList.contains('split-char')) return;
      [...node.childNodes].forEach(walk);
    }
  };
  [...el.childNodes].forEach(walk);
  el.dataset.splitDone = '1';
  return nodes;
}

/* --------------------------------------------------------------------------
   Per-char reveal on scroll for every section title (rise + fade + slight
   rotate). Uses manual splitter above.
   -------------------------------------------------------------------------- */
export function initCharReveals() {
  const titles = document.querySelectorAll('.section__title, .cta__title');
  titles.forEach((title) => {
    const chars = splitChars(title);
    if (!chars.length) return;
    gsap.set(chars, { yPercent: 110, rotate: 6, opacity: 0 });
    gsap.to(chars, {
      yPercent: 0,
      rotate: 0,
      opacity: 1,
      duration: 0.9,
      ease: 'power3.out',
      stagger: 0.018,
      scrollTrigger: {
        trigger: title,
        start: 'top 85%',
      },
    });
  });
}

/* --------------------------------------------------------------------------
   3D tilt on cards using pointer position -> CSS custom properties.
   Reads --rx / --ry from JS-set inline props consumed by the stylesheet.
   -------------------------------------------------------------------------- */
export function initTilt(selector, opts = {}) {
  const strength = opts.strength ?? 8; // degrees
  const cards = document.querySelectorAll(selector);
  cards.forEach((card) => {
    let raf = 0, rx = 0, ry = 0, targetRx = 0, targetRy = 0;
    let hovering = false;

    const loop = () => {
      rx += (targetRx - rx) * 0.15;
      ry += (targetRy - ry) * 0.15;
      card.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
      card.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
      if (hovering || Math.abs(rx - targetRx) > 0.02 || Math.abs(ry - targetRy) > 0.02) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = 0;
      }
    };

    card.addEventListener('pointerenter', () => {
      hovering = true;
      card.classList.add('is-tilted');
      if (!raf) raf = requestAnimationFrame(loop);
    });

    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1;   // -1..1
      const ny = ((e.clientY - r.top) / r.height) * 2 - 1;   // -1..1
      targetRy = nx * strength;
      targetRx = -ny * strength;
      const mx = ((e.clientX - r.left) / r.width) * 100;
      const my = ((e.clientY - r.top) / r.height) * 100;
      card.style.setProperty('--mx', `${mx}%`);
      card.style.setProperty('--my', `${my}%`);
    });

    card.addEventListener('pointerleave', () => {
      hovering = false;
      targetRx = 0;
      targetRy = 0;
      card.classList.remove('is-tilted');
      if (!raf) raf = requestAnimationFrame(loop);
    });
  });
}

/* --------------------------------------------------------------------------
   Card "flip-in" replacement for plain fade-up: rotateY: -22, scale 0.9
   -------------------------------------------------------------------------- */
export function flipInCards(selector, opts = {}) {
  const items = gsap.utils.toArray(selector);
  if (!items.length) return;
  gsap.set(items, { transformPerspective: 900 });
  gsap.from(items, {
    rotateY: -22,
    rotateX: 8,
    y: 60,
    scale: 0.9,
    opacity: 0,
    duration: 1,
    ease: 'power3.out',
    stagger: opts.stagger || 0.08,
    clearProps: 'transform,transformPerspective',
    scrollTrigger: {
      trigger: items[0].parentElement,
      start: opts.start || 'top 82%',
    },
  });
}

/* --------------------------------------------------------------------------
   Section wipe reveal: full-viewport colored panel that slides up as each
   section enters. Consumes `[data-wipe]` elements already in the DOM.
   -------------------------------------------------------------------------- */
export function initSectionWipes() {
  document.querySelectorAll('[data-wipe]').forEach((wipe) => {
    const section = wipe.closest('[data-section]');
    if (!section) return;
    gsap.set(wipe, { yPercent: 100 });
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top 95%',
        toggleActions: 'play none none reverse',
      },
    });
    tl.to(wipe, { yPercent: 0, duration: 0.55, ease: 'power3.inOut' })
      .to(wipe, { yPercent: -100, duration: 0.75, ease: 'power3.inOut' }, '+=0.05');
  });
}

/* --------------------------------------------------------------------------
   Magnetic buttons: button follows cursor within a radius, springs back.
   -------------------------------------------------------------------------- */
export function initMagnetic(selector, radius = 120, pull = 0.35) {
  document.querySelectorAll(selector).forEach((btn) => {
    let raf = 0, tx = 0, ty = 0, cx = 0, cy = 0;
    const inner = btn.querySelector('[data-magnetic-inner]') || btn;

    const loop = () => {
      cx += (tx - cx) * 0.18;
      cy += (ty - cy) * 0.18;
      inner.style.transform = `translate3d(${cx.toFixed(2)}px, ${cy.toFixed(2)}px, 0)`;
      if (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = 0;
      }
    };

    const move = (e) => {
      const r = btn.getBoundingClientRect();
      const bx = r.left + r.width / 2;
      const by = r.top + r.height / 2;
      const dx = e.clientX - bx;
      const dy = e.clientY - by;
      const dist = Math.hypot(dx, dy);
      if (dist < radius) {
        tx = dx * pull;
        ty = dy * pull;
      } else {
        tx = 0;
        ty = 0;
      }
      if (!raf) raf = requestAnimationFrame(loop);
    };

    const leave = () => {
      tx = 0;
      ty = 0;
      if (!raf) raf = requestAnimationFrame(loop);
    };

    window.addEventListener('pointermove', move, { passive: true });
    btn.addEventListener('pointerleave', leave);
  });
}

/* --------------------------------------------------------------------------
   Parallax on decorative shapes ([data-parallax] elements).
   -------------------------------------------------------------------------- */
export function initParallax() {
  document.querySelectorAll('[data-parallax]').forEach((el) => {
    const speed = parseFloat(el.dataset.parallax) || 0.3;
    gsap.to(el, {
      yPercent: -speed * 100,
      ease: 'none',
      scrollTrigger: {
        trigger: el.closest('[data-section]') || el,
        start: 'top bottom',
        end: 'bottom top',
        scrub: true,
      },
    });
  });
}

/* --------------------------------------------------------------------------
   Services pin: pin the services section briefly and stage-reveal each
   service row one at a time as the user scrolls through the pin.
   -------------------------------------------------------------------------- */
export function initServicesPin() {
  // Formerly pinned the services section for a staged reveal.
  // The pin + backdrop-filter combo on .section caused ScrollTriggers below
  // to drift out of sync, so we now use a simple stagger reveal on all
  // viewports — same visual result, no scroll geometry side-effects.
  const section = document.querySelector('[data-section="services"]');
  if (!section) return;
  const rows = section.querySelectorAll('[data-service]');
  if (!rows.length) return;

  gsap.from(rows, {
    y: 40,
    x: -40,
    opacity: 0,
    filter: 'blur(0.5rem)',
    duration: 0.85,
    ease: 'power3.out',
    stagger: 0.09,
    scrollTrigger: {
      trigger: section,
      start: 'top 82%',
    },
  });
}

/* --------------------------------------------------------------------------
   Kinetic marquee word — a specific word ([data-kinetic]) inside a marquee
   scrolls opposite to page scroll velocity.
   -------------------------------------------------------------------------- */
export function initKineticWord() {
  const word = document.querySelector('[data-kinetic]');
  if (!word) return;
  let target = 0, current = 0;
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      // velocity is signed; magnify and dampen
      target = self.getVelocity() * -0.02;
    },
  });
  gsap.ticker.add(() => {
    current += (target - current) * 0.08;
    target *= 0.9; // decay when idle
    word.style.transform = `translate3d(${current.toFixed(2)}px, 0, 0)`;
  });
}

/* --------------------------------------------------------------------------
   Custom cursor: instant dot + trailing ring, scales on interactive hover.
   -------------------------------------------------------------------------- */
export function initCustomCursor() {
  if (window.matchMedia('(pointer: coarse)').matches) return;
  const cursor = document.querySelector('[data-cursor]');
  if (!cursor) return;
  const dot = cursor.querySelector('.cursor__dot');
  const ring = cursor.querySelector('.cursor__ring');
  if (!dot || !ring) return;

  document.body.classList.add('has-custom-cursor');
  let mx = window.innerWidth / 2, my = window.innerHeight / 2;
  let dx = mx, dy = my, rx = mx, ry = my;

  window.addEventListener('pointermove', (e) => {
    mx = e.clientX;
    my = e.clientY;
  }, { passive: true });

  gsap.ticker.add(() => {
    // Dot follows nearly instantly
    dx += (mx - dx) * 0.55;
    dy += (my - dy) * 0.55;
    // Ring trails
    rx += (mx - rx) * 0.15;
    ry += (my - ry) * 0.15;
    dot.style.transform = `translate3d(${dx}px, ${dy}px, 0) translate(-50%, -50%)`;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%)`;
  });

  const growSel = 'a, button, [data-service], [data-tilt], [data-industry], [data-platform], [data-pillar], [data-magnetic], [data-testimonials], input, textarea';
  document.addEventListener('pointerover', (e) => {
    if (e.target.closest && e.target.closest(growSel)) {
      cursor.classList.add('is-hover');
    }
  });
  document.addEventListener('pointerout', (e) => {
    if (e.target.closest && e.target.closest(growSel)) {
      cursor.classList.remove('is-hover');
    }
  });
}

/* --------------------------------------------------------------------------
   Extended loader: draw the T logo (stroke-dashoffset) then hand over to
   the progress bar. Called before the fake-progress ticker starts.
   -------------------------------------------------------------------------- */
export function drawLoaderLogo() {
  const logo = document.querySelector('[data-loader-svg]');
  if (!logo) return null;
  const paths = logo.querySelectorAll('path, line');
  paths.forEach((p) => {
    const len = p.getTotalLength ? p.getTotalLength() : 100;
    p.style.strokeDasharray = `${len}`;
    p.style.strokeDashoffset = `${len}`;
  });
  return gsap.to(paths, {
    strokeDashoffset: 0,
    duration: 1.1,
    ease: 'power2.out',
    stagger: 0.12,
  });
}

/* --------------------------------------------------------------------------
   Curtain reveal: two panels split apart when the loader finishes.
   -------------------------------------------------------------------------- */
export function playCurtainReveal() {
  const top = document.querySelector('[data-curtain-top]');
  const bot = document.querySelector('[data-curtain-bottom]');
  if (!top || !bot) return;
  gsap.set([top, bot], { display: 'block' });
  const tl = gsap.timeline({
    onComplete: () => {
      top.remove();
      bot.remove();
    },
  });
  tl.to(top, { yPercent: -100, duration: 1.0, ease: 'power4.inOut' }, 0)
    .to(bot, { yPercent: 100,  duration: 1.0, ease: 'power4.inOut' }, 0);
}

/* --------------------------------------------------------------------------
   Scroll velocity feed for the WebGL scene: hooks Lenis scroll velocity
   and forwards a normalized value to a caller.
   -------------------------------------------------------------------------- */
export function initScrollVelocity(onVelocity) {
  let vel = 0;
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      const raw = self.getVelocity(); // px/s, signed
      vel = Math.min(1, Math.abs(raw) / 2500);
    },
  });
  gsap.ticker.add(() => {
    vel *= 0.9;
    if (typeof onVelocity === 'function') onVelocity(vel);
  });
}

/* --------------------------------------------------------------------------
   Section-enter callback: for each [data-section], call onEnter(name) when
   its top hits 60% of the viewport. WebGL uses this for burst particles.
   -------------------------------------------------------------------------- */
export function onSectionEnter(cb) {
  document.querySelectorAll('[data-section]').forEach((sec) => {
    ScrollTrigger.create({
      trigger: sec,
      start: 'top 60%',
      onEnter: () => cb(sec.dataset.section, sec),
      onEnterBack: () => cb(sec.dataset.section, sec),
    });
  });
}
