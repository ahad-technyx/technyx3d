# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start Vite dev server with HMR
- `npm run build` — production build to `dist/`
- `npm run preview` — serve the built `dist/` for local verification

No test runner, linter, or formatter is configured.

## Styling conventions

- **Do not use Tailwind.** Write plain CSS in `src/style.css` (or co-located CSS files).
- **All sizes in `rem`**, with the base font size assumed to be `16px` (so `1rem = 16px`, `0.5rem = 8px`, etc.). Avoid raw `px` for spacing, font sizes, radii, and component dimensions. `px` is acceptable only where it is genuinely required (e.g. `1px` borders, image intrinsic sizes).
- **Use CSS custom properties** for colors and media-query breakpoints — declare them once on `:root` and reference them everywhere instead of repeating literal values. Example:
  ```css
  :root {
    --color-primary: #...;
    --color-bg: #...;
    --bp-tablet: 48rem;
    --bp-desktop: 64rem;
  }
  ```
  Media queries should consume the same breakpoint values (via a shared convention) rather than hard-coding widths in each `@media` rule.
- **Components must be flexible and responsive so they can be reused.** Prefer fluid layouts (`flex`, `grid`, `%`, `min()/max()/clamp()`), avoid fixed widths/heights, and don't bake page-specific spacing into a component's own styles. A component should adapt to its container at any viewport size.

## Architecture

Vanilla-JS Vite starter (no framework). Entry flow:

- `index.html` is the Vite entry; it loads `/src/main.js` as an ES module and mounts everything into `<div id="app">`.
- `src/main.js` renders the entire UI by assigning a template literal to `#app`'s `innerHTML`, then wires interactive elements (currently just `setupCounter` from `src/counter.js`).
- Static assets imported from `src/assets/` (e.g. `hero.png`, `*.svg`) go through Vite's asset pipeline and resolve to hashed URLs at build time. Files under `public/` (`favicon.svg`, `icons.svg`) are served from the root unchanged — `index.html` and SVG `<use href="/icons.svg#...">` references depend on that root-relative path.
- Styles live in a single `src/style.css` imported by `main.js`.
