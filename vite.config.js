import { defineConfig } from 'vite';

// Build configured so dist/index.html works in TWO modes:
//   1. Served over HTTP (npm run preview, Netlify, any static host)
//   2. Opened directly via file:// (double-click index.html)
//
// To make file:// work we have to undo two Vite defaults:
//   • `crossorigin` on <link rel="stylesheet"> and <script> — browsers
//     refuse these resources under file:// because there is no origin.
//   • `type="module"` on the main bundle — most browsers block ES module
//     fetches via file://. We emit a classic IIFE bundle instead.
export default defineConfig({
  base: './',
  build: {
    // Emit one extracted CSS file (loaded via <link>) instead of injecting
    // the stylesheet from inside the JS bundle. The link is more robust:
    // styles render even if the IIFE bundle fails to execute (e.g. when
    // dist/index.html is opened directly via file:// on some browsers).
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  plugins: [
    {
      name: 'file-protocol-compat',
      apply: 'build',
      transformIndexHtml(html) {
        // Drop `crossorigin` everywhere (CSS link + JS script).
        html = html.replace(/\s+crossorigin(="[^"]*")?/g, '');
        // Demote `type="module"` to a classic script. Module scripts are
        // deferred by default; the classic form is not, so add `defer` to
        // preserve "run after HTML is parsed" — otherwise the script fires
        // in <head> before #app / #webgl exist and every getElementById()
        // returns null.
        html = html.replace(/<script\s+type="module"/g, '<script defer');
        return html;
      },
    },
  ],
});
