/* ==========================================================================
   DOM builder — constructs the entire page markup from the content model
   and mounts it into #app. Keeping this pure-DOM (no framework) so Vite's
   vanilla-JS starter constraint is honored.
   ========================================================================== */

import {
  NAV, HERO, AUDIENCE, STATS, SERVICES,
  INDUSTRIES, PLATFORMS, PILLARS, TESTIMONIALS, MARQUEE,
} from './content.js';

// Small helper – tagged template lookalike for cleaner markup blocks.
function h(html) { return html.trim(); }

export function renderApp(root) {
  root.innerHTML = h(`
    <div class="scroll-progress" aria-hidden="true"></div>

    <!-- Custom cursor (dot + trailing ring) -->
    <div class="cursor" data-cursor aria-hidden="true">
      <span class="cursor__ring"></span>
      <span class="cursor__dot"></span>
    </div>

    <!-- Curtain reveal panels (removed after intro) -->
    <div class="curtain curtain--top" data-curtain-top aria-hidden="true"></div>
    <div class="curtain curtain--bottom" data-curtain-bottom aria-hidden="true"></div>

    ${nav()}

    <main>
      ${hero()}
      ${marquee()}
      ${audience()}
      ${stats()}
      ${services()}
      ${industries()}
      ${platforms()}
      ${pillars()}
      ${testimonialsSection()}
      ${cta()}
    </main>

    ${footer()}
  `);
}

// -------------------------------------------------------------------------
function nav() {
  return h(`
    <header class="nav" data-nav>
      <a href="#home" class="nav__brand" aria-label="Technyx Systems">
        <span class="nav__brand-mark">T</span>
        <span>Technyx</span>
      </a>
      <nav aria-label="Primary">
        <ul class="nav__links">
          ${NAV.map(n => `<li><a href="${n.href}">${n.label}</a></li>`).join('')}
        </ul>
      </nav>
      <a href="#contact" class="nav__cta">
        <span class="nav__cta-dot"></span>
        <span>Get in Touch</span>
      </a>
      <button class="nav__toggle" aria-label="Menu">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M2 5h14M2 13h14" />
        </svg>
      </button>
    </header>
  `);
}

// -------------------------------------------------------------------------
function hero() {
  const line = (piece) => piece.accent
    ? `<span class="accent">${piece.text}</span>`
    : piece.text;

  return h(`
    <section id="home" class="hero" data-section="hero">
      <div class="container">
        <p class="hero__meta" data-hero-meta>${HERO.eyebrow}</p>

        <h1 class="hero__title" data-hero-title>
          ${HERO.headline.map(p => `
            <span class="hero__title-line">
              <span class="split-word">${line(p)}</span>
            </span>
          `).join('')}
        </h1>

        <p class="hero__lede" data-hero-lede>${HERO.lede}</p>

        <div class="hero__actions" data-hero-actions>
          <a class="btn btn--primary" href="${HERO.primary.href}" data-magnetic>
            <span data-magnetic-inner>
              ${HERO.primary.label}
              <span class="btn__arrow">→</span>
            </span>
          </a>
          <a class="btn btn--ghost" href="${HERO.secondary.href}" data-magnetic>
            <span data-magnetic-inner>
              ${HERO.secondary.label}
              <span class="btn__arrow">↓</span>
            </span>
          </a>
        </div>
      </div>

      <div class="hero__deco" aria-hidden="true">
        <span class="hero__blob hero__blob--a" data-parallax="0.35"></span>
        <span class="hero__blob hero__blob--b" data-parallax="0.55"></span>
        <span class="hero__blob hero__blob--c" data-parallax="0.2"></span>
      </div>

      <div class="hero__scroll" aria-hidden="true">
        <span>Scroll</span>
        <span class="hero__scroll-line"></span>
      </div>
    </section>
  `);
}

// -------------------------------------------------------------------------
function marquee() {
  const items = MARQUEE.map(m => `<span class="marquee__item">${m}</span>`).join('');
  return h(`
    <section class="marquee" aria-hidden="true">
      <div class="marquee__track" data-marquee>
        ${items}${items}
      </div>
      <span class="marquee__kinetic" data-kinetic>TECHNYX</span>
    </section>
  `);
}

// -------------------------------------------------------------------------
function audience() {
  return h(`
    <section id="audience" class="section" data-section="audience">
      <div class="container">
        <p class="section__eyebrow">Who We Work With</p>
        <h2 class="section__title">Built for Agencies, Brands, and Startups.</h2>
        <p class="section__lead">However you found us, you probably fit one of three groups — here\'s how we work with each.</p>

        <div class="audience">
          ${AUDIENCE.map(a => `
            <article class="audience__card" data-tilt>
              <p class="audience__badge">
                <span class="audience__badge-num">${a.num}</span>
                <span>/</span>
                <span>${a.tag}</span>
              </p>
              <h3 class="audience__title">${a.title}</h3>
              <p class="audience__desc">${a.body}</p>
            </article>
          `).join('')}
        </div>
      </div>
    </section>
  `);
}

// -------------------------------------------------------------------------
function stats() {
  return h(`
    <section id="results" class="section" data-section="stats">
      <div class="container">
        <p class="section__eyebrow">Delivering Results that Matter</p>
        <h2 class="section__title">A decade of delivery, in numbers.</h2>

        <div class="stats">
          ${STATS.map(s => `
            <div class="stats__cell">
              <span class="stats__num" data-count="${s.num}">
                <span class="stats__num-value">0</span><span class="stats__num-suffix">${s.suffix}</span>
              </span>
              <span class="stats__label">${s.label}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
  `);
}

// -------------------------------------------------------------------------
function services() {
  return h(`
    <section id="services" class="section" data-section="services">
      <span class="section-wipe" data-wipe aria-hidden="true"></span>
      <div class="container">
        <p class="section__eyebrow">What We Do</p>
        <h2 class="section__title">Specialized services, each independently engageable.</h2>
        <p class="section__lead">Explore what fits your project — no bundles, no cross-selling. Every engagement scoped to what you actually need.</p>

        <div class="services">
          ${SERVICES.map(s => `
            <a class="service" href="#contact" data-service>
              <span class="service__num">${s.num}</span>
              <div class="service__body">
                <h3 class="service__title">${s.title}</h3>
                <p class="service__desc">${s.desc}</p>
              </div>
              <span class="service__arrow" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M3 11L11 3M11 3H4M11 3v7" />
                </svg>
              </span>
            </a>
          `).join('')}
        </div>
      </div>
    </section>
  `);
}

// -------------------------------------------------------------------------
function industries() {
  return h(`
    <section id="industries" class="section" data-section="industries">
      <span class="section-wipe section-wipe--violet" data-wipe aria-hidden="true"></span>
      <div class="container">
        <p class="section__eyebrow">Who We Serve</p>
        <h2 class="section__title">Deep domain expertise, not a generic playbook.</h2>
        <p class="section__lead">From government platforms to global retail brands — industries where we bring more than generic technical delivery.</p>

        <div class="industries">
          ${INDUSTRIES.map(i => `
            <article class="industry" data-industry>
              <div class="industry__icon">${i.icon}</div>
              <h3 class="industry__title">${i.title}</h3>
              <p class="industry__desc">${i.desc}</p>
            </article>
          `).join('')}
        </div>
      </div>
    </section>
  `);
}

// -------------------------------------------------------------------------
function platforms() {
  return h(`
    <section id="platforms" class="section" data-section="platforms">
      <span class="section-wipe section-wipe--magenta" data-wipe aria-hidden="true"></span>
      <div class="container">
        <div class="platforms">
          <div>
            <p class="section__eyebrow">Platforms</p>
            <h2 class="section__title">Technologies we trust at scale.</h2>
            <p class="section__lead">Modern, battle-tested across mobile, frontend, and backend — chosen for performance and longevity, not hype.</p>
          </div>
          <div class="platforms__stack">
            ${PLATFORMS.map((p, i) => `
              <div class="platform-chip" data-platform>
                <span>${p}</span>
                <span class="platform-chip__label">0${i + 1}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </section>
  `);
}

// -------------------------------------------------------------------------
function pillars() {
  return h(`
    <section id="about" class="section" data-section="pillars">
      <div class="container">
        <p class="section__eyebrow">Why Technyx</p>
        <h2 class="section__title">Four things that hold true across every engagement.</h2>
        <p class="section__lead">Regardless of service or industry, these are the constants that define how we work.</p>

        <div class="pillars">
          ${PILLARS.map((p, i) => `
            <article class="pillar" data-pillar>
              <p class="pillar__num">0${i + 1}</p>
              <h3 class="pillar__title">${p.title}</h3>
              <p class="pillar__desc">${p.desc}</p>
            </article>
          `).join('')}
        </div>
      </div>
    </section>
  `);
}

// -------------------------------------------------------------------------
function testimonialsSection() {
  return h(`
    <section id="testimonials" class="section testimonials" data-section="testimonials">
      <div class="container">
        <p class="section__eyebrow">Voices</p>
        <h2 class="section__title">What our clients say.</h2>
        <p class="section__lead">Real feedback from the agencies, brands, and startups we\'ve delivered for.</p>
      </div>
      <div class="testimonials__track" data-testimonials>
        ${TESTIMONIALS.map(t => `
          <article class="testimonial">
            <p class="testimonial__quote">${t.quote}</p>
            <div class="testimonial__author">
              <div class="testimonial__avatar">${t.initials}</div>
              <div>
                <p class="testimonial__name">${t.name}</p>
                <p class="testimonial__role">${t.role}</p>
              </div>
            </div>
          </article>
        `).join('')}
      </div>
    </section>
  `);
}

// -------------------------------------------------------------------------
function cta() {
  return h(`
    <section id="contact" class="section" data-section="cta">
      <div class="container">
        <div class="cta" data-cta>
          <p class="section__eyebrow" style="margin:0;">Ready to Build?</p>
          <h2 class="cta__title">Let\'s scope your next platform, together.</h2>
          <p class="cta__desc">Our senior architects work directly with your leadership to define technical roadmaps, audit legacy systems, and identify high-impact innovation opportunities.</p>
          <a class="btn btn--primary" href="mailto:hello@technyx.systems" data-magnetic>
            <span data-magnetic-inner>
              Get in Touch
              <span class="btn__arrow">→</span>
            </span>
          </a>
        </div>
      </div>
    </section>
  `);
}

// -------------------------------------------------------------------------
function footer() {
  const col = (title, items) => `
    <div>
      <p class="footer__col-title">${title}</p>
      <ul class="footer__list">
        ${items.map(i => `<li><a href="#">${i}</a></li>`).join('')}
      </ul>
    </div>
  `;

  return h(`
    <footer class="footer">
      <div class="footer__grid">
        <div class="footer__brand">
          <p class="footer__brand-title">Technyx Systems</p>
          <p class="footer__brand-note">
            The AI-native technical partner behind the work you don\'t see.
            Senior-led engineering for agencies, brands, and startups worldwide.
          </p>
        </div>
        ${col('Quick Links', ['About Us', 'Agencies', 'Brands', 'Startups', 'Contact Us', "FAQ's"])}
        ${col('Services', SERVICES.map(s => s.title))}
        ${col('Platforms', PLATFORMS)}
      </div>
      <div class="footer__bottom">
        <span>© 2026 Technyx Systems. All rights reserved.</span>
        <ul class="footer__bottom-links">
          <li><a href="#">Cookies Policy</a></li>
          <li><a href="#">Terms &amp; Conditions</a></li>
          <li><a href="#">Privacy Policy</a></li>
        </ul>
      </div>
    </footer>
  `);
}
