/* ==========================================================================
   WebGL scene — Three.js. Renders a single full-viewport canvas that
   evolves as the user scrolls. Composition (IT / software-house / AI):
     - Central chip die (rounded-slab package + pin legs) with soft
       emissive traces — the "processor" at hero
     - Neural-network node graph (~40 glowing nodes + additive edges)
       with pulses (small emissive beads) travelling along each edge
     - Floating extruded code glyphs ({ } < > / \ ; () [] = * #) that
       drift on scroll-driven trajectories, some wire-only for variety
     - Circuit-board plane (procedural PCB traces + component pads)
       sitting behind everything, pitching on scroll
     - Data-flow curves (Catmull-Rom) with bright particles flowing
       along them like packets on wires
     - Atmospheric particle field (recoloured mint / violet / cyan)
     - "Data-stream conduit" tube (repurposed ribbon) with scanline
       shader that scrolls horizontal bands along its length
     - Extruded "TECHNYX" wordmark with a terminal-scanline gradient
       and a leading "$" cursor glyph
     - HUD-style cyan grid floor
     - Cursor-tracking accent point light
     - Click-anywhere shockwave burst
     - UnrealBloomPass on the composer for glowing accents
   All animations are driven by an external progress signal (0..1) so GSAP
   ScrollTrigger owns choreography. Includes resize handling, DPR clamping,
   pause-on-hidden, and reduced-motion downgrade.
   ========================================================================== */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/* --------------------------------------------------------------------------
   Small helpers.
   -------------------------------------------------------------------------- */
const smooth = (x) => THREE.MathUtils.smoothstep(x, 0, 1);
const band = (p, a, b) => THREE.MathUtils.smoothstep(p, a, b);
const invband = (p, a, b) => 1 - THREE.MathUtils.smoothstep(p, a, b);

/* Palette anchors — Technyx navy + warm gold, sampled from the reference
   site. Keys kept as `mint/violet/warm/deep` to avoid a sweeping rename
   through this file; the underlying hexes are now brand-accurate. */
const PAL = {
  mint:   0xefb75b, // brand gold (primary accent)
  violet: 0x007ca4, // ocean teal (secondary accent)
  warm:   0xfdf1da, // warm cream (soft accent for cursor/highlights)
  deep:   0x0f1527, // deep navy backdrop
};

/* --------------------------------------------------------------------------
   Build a rounded-corner rectangle Shape. Used for the chip die and for
   the "code glyph" strokes. Corners are quarter-arcs approximated by
   quadratic curves for cheapness.
   -------------------------------------------------------------------------- */
function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/* --------------------------------------------------------------------------
   Build a CPU / chip package: a rounded slab (the "die") with a subtle
   emissive trace pattern painted on top (a thinner inner slab in emissive
   material) and rows of tiny pin legs around the perimeter (instanced
   cylinders). Returns { group, dispose }.
   -------------------------------------------------------------------------- */
function buildChipCore() {
  const group = new THREE.Group();
  const geoms = [];
  const mats = [];

  // Package body — a rounded slab with a bevel so it reads as physical.
  const bodyShape = roundedRectShape(2.4, 2.4, 0.28);
  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
    depth: 0.36,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.06,
    bevelSegments: 2,
    curveSegments: 6,
  });
  bodyGeo.translate(0, 0, -0.18);
  bodyGeo.computeVertexNormals();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x0e1220,
    metalness: 0.55,
    roughness: 0.35,
    emissive: 0x081018,
    emissiveIntensity: 0.4,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(body);
  geoms.push(bodyGeo); mats.push(bodyMat);

  // Etched "die" — a smaller inset slab that glows in mint. Acts as the
  // silicon die on top of the package.
  const dieShape = roundedRectShape(1.6, 1.6, 0.14);
  const dieGeo = new THREE.ExtrudeGeometry(dieShape, {
    depth: 0.06,
    bevelEnabled: false,
    curveSegments: 4,
  });
  const dieMat = new THREE.MeshStandardMaterial({
    color: 0x2a1e08, // dark warm base so the gold emissive reads richer
    metalness: 0.3,
    roughness: 0.4,
    emissive: PAL.mint,
    emissiveIntensity: 0.55,
  });
  const die = new THREE.Mesh(dieGeo, dieMat);
  die.position.z = 0.19;
  group.add(die);
  geoms.push(dieGeo); mats.push(dieMat);

  // Emissive "traces" — a grid of thin bars on top of the die, drawn as
  // additive LineSegments so they read as etched circuitry.
  const traceGeo = new THREE.BufferGeometry();
  const tracePts = [];
  const TR_STEP = 0.16;
  const TR_HALF = 0.72;
  for (let i = -TR_HALF; i <= TR_HALF + 0.0001; i += TR_STEP) {
    // Horizontal traces with occasional gaps
    if (Math.random() > 0.35) {
      const x1 = -TR_HALF + Math.random() * 0.2;
      const x2 =  TR_HALF - Math.random() * 0.2;
      tracePts.push(x1, i, 0.001, x2, i, 0.001);
    }
    // Vertical traces with occasional gaps
    if (Math.random() > 0.35) {
      const y1 = -TR_HALF + Math.random() * 0.2;
      const y2 =  TR_HALF - Math.random() * 0.2;
      tracePts.push(i, y1, 0.001, i, y2, 0.001);
    }
  }
  traceGeo.setAttribute('position', new THREE.Float32BufferAttribute(tracePts, 3));
  const traceMat = new THREE.LineBasicMaterial({
    color: PAL.mint,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const traces = new THREE.LineSegments(traceGeo, traceMat);
  traces.position.z = 0.25;
  group.add(traces);
  geoms.push(traceGeo); mats.push(traceMat);

  // Pin legs — short cylinders around all four edges. Instanced for cheap.
  const pinGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.24, 6);
  const pinMat = new THREE.MeshStandardMaterial({
    color: 0xc7cdd8,
    metalness: 0.9,
    roughness: 0.35,
    emissive: 0x101418,
    emissiveIntensity: 0.2,
  });
  const PINS_PER_SIDE = 14;
  const pinTotal = PINS_PER_SIDE * 4;
  const pins = new THREE.InstancedMesh(pinGeo, pinMat, pinTotal);
  const tmp = new THREE.Object3D();
  const halfW = 1.2;
  const step = (halfW * 2 - 0.4) / (PINS_PER_SIDE - 1);
  const start = -halfW + 0.2;
  let pIdx = 0;
  for (let i = 0; i < PINS_PER_SIDE; i++) {
    const t = start + i * step;
    // Bottom edge (y = -halfW), pin sticks out along -Y then rotates
    tmp.position.set(t, -halfW - 0.02, 0);
    tmp.rotation.set(0, 0, 0); // cylinder axis is along Y — perfect
    tmp.updateMatrix();
    pins.setMatrixAt(pIdx++, tmp.matrix);
    // Top edge
    tmp.position.set(t, halfW + 0.02, 0);
    tmp.updateMatrix();
    pins.setMatrixAt(pIdx++, tmp.matrix);
    // Left edge — rotate cylinder to lie along X
    tmp.position.set(-halfW - 0.02, t, 0);
    tmp.rotation.set(0, 0, Math.PI / 2);
    tmp.updateMatrix();
    pins.setMatrixAt(pIdx++, tmp.matrix);
    // Right edge
    tmp.position.set(halfW + 0.02, t, 0);
    tmp.updateMatrix();
    pins.setMatrixAt(pIdx++, tmp.matrix);
    tmp.rotation.set(0, 0, 0);
  }
  pins.instanceMatrix.needsUpdate = true;
  group.add(pins);
  geoms.push(pinGeo); mats.push(pinMat);

  // Overall scale so it feels similar in visual weight to the old icosahedron.
  group.scale.setScalar(0.62);

  function dispose() {
    geoms.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
  }

  return {
    group,
    dieMat,
    traceMat,
    bodyMat,
    dispose,
  };
}

/* --------------------------------------------------------------------------
   Build a neural-network node graph:
     - N glowing spheres arranged in a rough ellipsoidal cloud around the core
     - LineSegments connecting nearby node pairs (edges) with additive blend
     - A "pulse" bead per edge that slides source→target on a staggered timer
   Returns { group, update(dt, progress, time, velocity), dispose }.
   -------------------------------------------------------------------------- */
function buildNodeGraph(nodeCount = 40) {
  const group = new THREE.Group();
  const geoms = [];
  const mats = [];

  // 1) Nodes — instanced small spheres so the count is cheap.
  const nodeGeo = new THREE.SphereGeometry(0.055, 10, 10);
  const nodeMat = new THREE.MeshStandardMaterial({
    color: PAL.mint,
    metalness: 0.2,
    roughness: 0.5,
    emissive: PAL.mint,
    emissiveIntensity: 0.9,
  });
  const nodes = new THREE.InstancedMesh(nodeGeo, nodeMat, nodeCount);
  const nodePos = new Array(nodeCount);
  const tmp = new THREE.Object3D();

  for (let i = 0; i < nodeCount; i++) {
    // Ellipsoidal cloud roughly around origin, avoiding the immediate core.
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 1.8 + Math.random() * 1.6;
    const p = new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta) * r * 1.2,
      Math.sin(phi) * Math.sin(theta) * r * 0.9,
      Math.cos(phi) * r * 0.7 - 0.4,
    );
    nodePos[i] = p;
    tmp.position.copy(p);
    tmp.updateMatrix();
    nodes.setMatrixAt(i, tmp.matrix);
  }
  nodes.instanceMatrix.needsUpdate = true;
  group.add(nodes);
  geoms.push(nodeGeo); mats.push(nodeMat);

  // 2) Edges — connect nodes that are within a distance threshold, capped
  // to keep the count reasonable.
  const edgePairs = [];
  const CONNECT_MAX_DIST = 1.6;
  const EDGES_MAX = Math.round(nodeCount * 1.6);
  for (let i = 0; i < nodeCount && edgePairs.length < EDGES_MAX; i++) {
    for (let j = i + 1; j < nodeCount && edgePairs.length < EDGES_MAX; j++) {
      const d = nodePos[i].distanceTo(nodePos[j]);
      if (d < CONNECT_MAX_DIST && Math.random() < 0.55) {
        edgePairs.push([i, j]);
      }
    }
  }
  // Fallback: ensure at least a few edges even in a sparse cloud.
  while (edgePairs.length < Math.min(EDGES_MAX, 30)) {
    const a = Math.floor(Math.random() * nodeCount);
    const b = Math.floor(Math.random() * nodeCount);
    if (a !== b) edgePairs.push([a, b]);
  }

  const edgePositions = new Float32Array(edgePairs.length * 2 * 3);
  for (let e = 0; e < edgePairs.length; e++) {
    const [a, b] = edgePairs[e];
    edgePositions[e * 6 + 0] = nodePos[a].x;
    edgePositions[e * 6 + 1] = nodePos[a].y;
    edgePositions[e * 6 + 2] = nodePos[a].z;
    edgePositions[e * 6 + 3] = nodePos[b].x;
    edgePositions[e * 6 + 4] = nodePos[b].y;
    edgePositions[e * 6 + 5] = nodePos[b].z;
  }
  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
  const edgeMat = new THREE.LineBasicMaterial({
    color: PAL.violet,
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const edges = new THREE.LineSegments(edgeGeo, edgeMat);
  group.add(edges);
  geoms.push(edgeGeo); mats.push(edgeMat);

  // 3) Pulses — a bright bead per edge that slides A→B. Points geometry
  // over the same edge list, one point per edge, position rewritten per frame.
  const pulseGeo = new THREE.BufferGeometry();
  const pulsePositions = new Float32Array(edgePairs.length * 3);
  const pulseColors = new Float32Array(edgePairs.length * 3);
  // Per-edge random offset so pulses are staggered and travel at slightly
  // different speeds.
  const pulseOffset = new Float32Array(edgePairs.length);
  const pulseSpeed = new Float32Array(edgePairs.length);
  const cMint = new THREE.Color(PAL.mint);
  const cViolet = new THREE.Color(PAL.violet);
  for (let e = 0; e < edgePairs.length; e++) {
    pulseOffset[e] = Math.random();
    pulseSpeed[e] = 0.25 + Math.random() * 0.35;
    const mix = Math.random();
    const c = cMint.clone().lerp(cViolet, mix);
    pulseColors[e * 3 + 0] = c.r;
    pulseColors[e * 3 + 1] = c.g;
    pulseColors[e * 3 + 2] = c.b;
  }
  pulseGeo.setAttribute('position', new THREE.BufferAttribute(pulsePositions, 3));
  pulseGeo.setAttribute('color', new THREE.BufferAttribute(pulseColors, 3));
  const pulseMat = new THREE.PointsMaterial({
    size: 0.14,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const pulses = new THREE.Points(pulseGeo, pulseMat);
  group.add(pulses);
  geoms.push(pulseGeo); mats.push(pulseMat);

  // Update: slide pulses along their edge, wrap at t=1.
  function update(dt, progress, time, velocity) {
    const arr = pulseGeo.attributes.position.array;
    // Speed of pulses scales gently with scroll velocity.
    const globalSpeed = 1 + velocity * 3;
    for (let e = 0; e < edgePairs.length; e++) {
      const [a, b] = edgePairs[e];
      const A = nodePos[a];
      const B = nodePos[b];
      // Cycle t ∈ [0..1]
      let t = (pulseOffset[e] + time * pulseSpeed[e] * globalSpeed) % 1;
      arr[e * 3 + 0] = A.x + (B.x - A.x) * t;
      arr[e * 3 + 1] = A.y + (B.y - A.y) * t;
      arr[e * 3 + 2] = A.z + (B.z - A.z) * t;
    }
    pulseGeo.attributes.position.needsUpdate = true;

    // Nodes/edges opacity react to scroll: strongest around 0.15-0.6, still
    // visible after but softer.
    const strength = 0.4 + band(progress, 0.05, 0.35) * 0.4 - band(progress, 0.7, 1.0) * 0.35;
    edgeMat.opacity = Math.max(0.08, 0.3 * strength + Math.sin(time * 0.8) * 0.05);
    pulseMat.opacity = Math.max(0.2, 0.9 * strength);
    nodeMat.emissiveIntensity = 0.6 + Math.sin(time * 1.4) * 0.15;
  }

  function dispose() {
    geoms.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
  }

  return { group, update, dispose };
}

/* --------------------------------------------------------------------------
   Build extruded 3D code glyphs from THREE.Shape rectangles. Stylised,
   blocky — not typographically accurate. Each returned entry has:
     mesh, from, to, spin, phase, band, mat
   -------------------------------------------------------------------------- */
function makeGlyphShape(kind) {
  // Every shape is drawn inside a unit box [-0.5..0.5] × [-0.5..0.5].
  // We build one or more THREE.Shape rectangles per glyph.
  const shapes = [];
  const rect = (x, y, w, h) => {
    const s = new THREE.Shape();
    s.moveTo(x, y);
    s.lineTo(x + w, y);
    s.lineTo(x + w, y + h);
    s.lineTo(x, y + h);
    s.closePath();
    shapes.push(s);
  };
  const T = 0.14; // stroke thickness

  switch (kind) {
    case '{':
      rect(-0.30, -0.5, T, 1.0);
      rect(-0.30, -0.5, 0.22, T);
      rect(-0.30, 0.5 - T, 0.22, T);
      rect(-0.16, -T / 2, 0.22, T);
      break;
    case '}':
      rect(0.30 - T, -0.5, T, 1.0);
      rect(0.08, -0.5, 0.22, T);
      rect(0.08, 0.5 - T, 0.22, T);
      rect(-0.06, -T / 2, 0.22, T);
      break;
    case '<':
      // Two stepped diagonals meeting at the middle-left
      rect(0.18, 0.35, 0.20, T);
      rect(0.02, 0.20, 0.20, T);
      rect(-0.14, 0.05, 0.20, T);
      rect(-0.14, -0.05 - T, 0.20, T);
      rect(0.02, -0.20 - T, 0.20, T);
      rect(0.18, -0.35 - T, 0.20, T);
      break;
    case '>':
      rect(-0.38, 0.35, 0.20, T);
      rect(-0.22, 0.20, 0.20, T);
      rect(-0.06, 0.05, 0.20, T);
      rect(-0.06, -0.05 - T, 0.20, T);
      rect(-0.22, -0.20 - T, 0.20, T);
      rect(-0.38, -0.35 - T, 0.20, T);
      break;
    case '/':
      rect(-0.34, -0.42, T, 0.22);
      rect(-0.20, -0.22, T, 0.22);
      rect(-0.06, -0.02, T, 0.22);
      rect(0.08, 0.18, T, 0.22);
      break;
    case '\\':
      rect(0.08, -0.42, T, 0.22);
      rect(-0.06, -0.22, T, 0.22);
      rect(-0.20, -0.02, T, 0.22);
      rect(-0.34, 0.18, T, 0.22);
      break;
    case ';':
      rect(-0.08, 0.05, 0.16, 0.16);
      rect(-0.08, -0.30, 0.16, 0.16);
      rect(-0.08, -0.44, T, 0.14);
      break;
    case '()':
      // Left paren
      rect(-0.38, -0.42, T, 0.84);
      rect(-0.30, -0.42, 0.10, T);
      rect(-0.30, 0.42 - T, 0.10, T);
      // Right paren
      rect(0.24, -0.42, T, 0.84);
      rect(0.14, -0.42, 0.10, T);
      rect(0.14, 0.42 - T, 0.10, T);
      break;
    case '[]':
      // Left bracket
      rect(-0.38, -0.42, T, 0.84);
      rect(-0.38, -0.42, 0.16, T);
      rect(-0.38, 0.42 - T, 0.16, T);
      // Right bracket
      rect(0.24, -0.42, T, 0.84);
      rect(0.24, -0.42, 0.16, T);
      rect(0.24, 0.42 - T, 0.16, T);
      break;
    case '=':
      rect(-0.30, 0.06, 0.60, T);
      rect(-0.30, -0.20, 0.60, T);
      break;
    case '*':
      rect(-0.30, -T / 2, 0.60, T);          // horizontal
      rect(-T / 2, -0.30, T, 0.60);          // vertical
      rect(-0.22, -0.22, T, 0.10);           // diag ticks
      rect(0.12, 0.12, T, 0.10);
      rect(-0.22, 0.12, T, 0.10);
      rect(0.12, -0.22, T, 0.10);
      break;
    case '#':
      rect(-0.18, -0.4, T, 0.8);
      rect(0.04, -0.4, T, 0.8);
      rect(-0.3, -0.10, 0.6, T);
      rect(-0.3, 0.12, 0.6, T);
      break;
    case '@':
      rect(-0.28, -0.36, 0.56, T);
      rect(-0.28, 0.30, 0.56, T);
      rect(-0.28, -0.36, T, 0.66);
      rect(0.24, -0.36, T, 0.50);
      rect(-0.10, -0.14, 0.30, T);
      rect(0.06, -0.14, T, 0.24);
      rect(-0.10, 0.10, 0.30, T);
      break;
    case '&':
      rect(-0.22, -0.30, T, 0.60);
      rect(-0.22, 0.24, 0.30, T);
      rect(-0.22, -0.02, 0.30, T);
      rect(-0.22, -0.30, 0.30, T);
      rect(0.06, -0.30, T, 0.20);
      rect(0.06, 0.10, T, 0.14);
      break;
    default:
      rect(-0.1, -0.1, 0.2, 0.2);
  }
  return shapes;
}

/* --------------------------------------------------------------------------
   Build a curved data-stream conduit (repurposed ribbon). Same TubeGeometry
   scaffolding as before, but the shader now scrolls horizontal emissive
   bands along the tube (fake "packets" moving through). Returns:
     { mesh, rebuild, dispose, getMaterial }
   -------------------------------------------------------------------------- */
function buildDataStream() {
  const POINT_COUNT = 10;
  const SEG = 220;
  const RADIAL = 10;

  const pts = [];
  for (let i = 0; i < POINT_COUNT; i++) {
    const t = i / (POINT_COUNT - 1);
    pts.push(new THREE.Vector3(
      Math.cos(t * Math.PI * 2) * 4,
      (t - 0.5) * 6,
      Math.sin(t * Math.PI * 2) * 4 - 2,
    ));
  }

  let curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
  let geo = new THREE.TubeGeometry(curve, SEG, 0.07, RADIAL, false);

  const mat = new THREE.MeshStandardMaterial({
    color: 0x0e2028,
    metalness: 0.35,
    roughness: 0.4,
    emissive: 0x08182a,
    emissiveIntensity: 0.35,
    transparent: true,
    opacity: 0.95,
  });
  // Shader override: paint scrolling emissive bands using tube UV.y (which
  // runs along the length of the tube).
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uSpeed = { value: 1.4 };
    mat.userData.shader = shader;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec2 vTubeUv;'
      )
      .replace(
        '#include <uv_vertex>',
        '#include <uv_vertex>\nvTubeUv = uv;'
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec2 vTubeUv;\nuniform float uTime;\nuniform float uSpeed;'
      )
      .replace(
        'vec4 diffuseColor = vec4( diffuse, opacity );',
        `
        // Two colours: cyan/mint base + violet troughs
        vec3 base   = vec3(0.06, 0.14, 0.18);
        vec3 tintA  = vec3(0.486, 0.960, 0.757);   // #7cf5c1
        vec3 tintB  = vec3(0.658, 0.517, 1.000);   // #a884ff

        // Scrolling scanline bands along the length of the tube.
        float f = fract(vTubeUv.x * 6.0 - uTime * uSpeed);
        // Bright thin bands
        float band  = smoothstep(0.86, 0.94, f) - smoothstep(0.94, 1.00, f);
        float band2 = smoothstep(0.36, 0.44, f) - smoothstep(0.44, 0.50, f);
        vec3 col = base + tintA * band * 1.4 + tintB * band2 * 0.7;

        // Add faint continuous glow along the tube
        col += tintA * 0.05;

        vec4 diffuseColor = vec4( col, opacity );
        `
      )
      .replace(
        'vec3 totalEmissiveRadiance = emissive;',
        `
        vec3 totalEmissiveRadiance = emissive;
        float f2 = fract(vTubeUv.x * 6.0 - uTime * uSpeed);
        float eBand = smoothstep(0.86, 0.94, f2) - smoothstep(0.94, 1.00, f2);
        totalEmissiveRadiance += vec3(0.486, 0.960, 0.757) * eBand * 0.9;
        `
      );
  };

  const mesh = new THREE.Mesh(geo, mat);

  function rebuild(progress, time) {
    const fresh = [];
    for (let i = 0; i < POINT_COUNT; i++) {
      const t = i / (POINT_COUNT - 1);
      const phase = t * Math.PI * 2 + progress * Math.PI * 1.6 + time * 0.05;
      const radius = 3.4 + Math.sin(t * Math.PI * 3 + progress * 3) * 1.1;
      fresh.push(new THREE.Vector3(
        Math.cos(phase) * radius,
        (t - 0.5) * (5 + progress * 3) + Math.sin(time * 0.2 + t * 5) * 0.4,
        Math.sin(phase) * radius - 1.5 + Math.cos(t * 4 + progress * 2) * 0.8,
      ));
    }
    curve = new THREE.CatmullRomCurve3(fresh, false, 'catmullrom', 0.5);
    const next = new THREE.TubeGeometry(curve, SEG, 0.07 + progress * 0.02, RADIAL, false);
    mesh.geometry.dispose();
    mesh.geometry = next;
    geo = next;
  }

  function dispose() {
    mesh.geometry.dispose();
    mat.dispose();
  }

  return { mesh, rebuild, dispose, getMaterial: () => mat };
}

/* --------------------------------------------------------------------------
   Build an extruded 3D wordmark ("TECHNYX") from block-letter shapes with
   a leading "$" cursor glyph. Applies a scanline emissive gradient (via
   onBeforeCompile) so it reads like text on a terminal.
   -------------------------------------------------------------------------- */
function buildWordmark(text, opts = {}) {
  const {
    size = 1,
    depth = 0.35,
    gap = 0.22,
    color = PAL.violet,
    emissive = 0x00243a, // deep teal to sit under PAL.violet (ocean teal)
  } = opts;

  const STROKES = {
    // "$" cursor prompt — a stylised block dollar sign
    $: [
      [0.15, 0.15, 0.70, 0.15],
      [0.15, 0.42, 0.70, 0.15],
      [0.15, 0.70, 0.70, 0.15],
      [0.15, 0.15, 0.15, 0.30],
      [0.70, 0.42, 0.15, 0.30],
      [0.42, 0.00, 0.16, 1.00], // vertical bar of $
    ],
    T: [
      [0.00, 0.85, 1.00, 0.15],
      [0.42, 0.00, 0.16, 0.85],
    ],
    E: [
      [0.00, 0.00, 1.00, 0.15],
      [0.00, 0.42, 0.90, 0.15],
      [0.00, 0.85, 1.00, 0.15],
      [0.00, 0.00, 0.18, 1.00],
    ],
    C: [
      [0.00, 0.00, 1.00, 0.15],
      [0.00, 0.85, 1.00, 0.15],
      [0.00, 0.00, 0.18, 1.00],
    ],
    H: [
      [0.00, 0.00, 0.18, 1.00],
      [0.82, 0.00, 0.18, 1.00],
      [0.00, 0.42, 1.00, 0.15],
    ],
    N: [
      [0.00, 0.00, 0.18, 1.00],
      [0.82, 0.00, 0.18, 1.00],
      [0.18, 0.72, 0.16, 0.13],
      [0.30, 0.58, 0.16, 0.13],
      [0.42, 0.44, 0.16, 0.13],
      [0.54, 0.30, 0.16, 0.13],
      [0.66, 0.16, 0.16, 0.13],
    ],
    Y: [
      [0.00, 0.65, 0.18, 0.35],
      [0.82, 0.65, 0.18, 0.35],
      [0.14, 0.50, 0.20, 0.20],
      [0.66, 0.50, 0.20, 0.20],
      [0.42, 0.00, 0.16, 0.55],
    ],
    X: [
      [0.00, 0.85, 0.18, 0.15],
      [0.16, 0.68, 0.18, 0.15],
      [0.32, 0.50, 0.18, 0.15],
      [0.48, 0.32, 0.18, 0.15],
      [0.64, 0.15, 0.18, 0.15],
      [0.82, 0.00, 0.18, 0.15],
      [0.82, 0.85, 0.18, 0.15],
      [0.66, 0.68, 0.18, 0.15],
      [0.50, 0.50, 0.18, 0.15],
      [0.34, 0.32, 0.18, 0.15],
      [0.18, 0.15, 0.18, 0.15],
      [0.00, 0.00, 0.18, 0.15],
    ],
  };

  const shapes = [];
  const letters = ('$ ' + text.toUpperCase()).split('');
  const letterWidth = 1;
  let cursor = 0;

  letters.forEach((ch) => {
    if (ch === ' ') { cursor += letterWidth * 0.5 + gap; return; }
    const strokes = STROKES[ch];
    if (!strokes) { cursor += letterWidth + gap; return; }
    strokes.forEach(([x, y, w, h]) => {
      const s = new THREE.Shape();
      s.moveTo(cursor + x,       y);
      s.lineTo(cursor + x + w,   y);
      s.lineTo(cursor + x + w,   y + h);
      s.lineTo(cursor + x,       y + h);
      s.closePath();
      shapes.push(s);
    });
    cursor += letterWidth + gap;
  });

  const totalW = cursor - gap;
  const geo = new THREE.ExtrudeGeometry(shapes, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
    curveSegments: 4,
  });
  geo.translate(-totalW / 2, -0.5, -depth / 2);
  geo.scale(size, size, size);
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.85,
    roughness: 0.22,
    emissive,
    emissiveIntensity: 0.6,
  });
  // Terminal-style horizontal scanlines on the emissive channel.
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    mat.userData.shader = shader;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vLocalPos;'
      )
      .replace(
        '#include <fog_vertex>',
        '#include <fog_vertex>\nvLocalPos = position;'
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vLocalPos;\nuniform float uTime;'
      )
      .replace(
        'vec3 totalEmissiveRadiance = emissive;',
        `
        vec3 totalEmissiveRadiance = emissive;
        // Horizontal scanlines that slowly drift down the letters.
        float scan = 0.5 + 0.5 * sin(vLocalPos.y * 22.0 - uTime * 2.4);
        totalEmissiveRadiance *= (0.6 + scan * 0.7);
        `
      );
  };

  const mesh = new THREE.Mesh(geo, mat);
  mesh.visible = false;

  return {
    mesh,
    dispose: () => { geo.dispose(); mat.dispose(); },
    getMaterial: () => mat,
  };
}

/* --------------------------------------------------------------------------
   Build a procedural circuit-board plane. Walks N random paths on a grid
   using cardinal directions with occasional 90° turns; emits LineSegments
   for traces and small emissive "pads" at endpoints/intersections.
   Returns { group, dispose }.
   -------------------------------------------------------------------------- */
function buildCircuitBoard() {
  const group = new THREE.Group();
  const geoms = [];
  const mats = [];

  const SPAN_X = 22;
  const SPAN_Y = 14;
  const COLS = 44;
  const ROWS = 28;
  const cellX = SPAN_X / (COLS - 1);
  const cellY = SPAN_Y / (ROWS - 1);
  const cellToWorld = (cx, cy) => new THREE.Vector3(
    (cx / (COLS - 1) - 0.5) * SPAN_X,
    (cy / (ROWS - 1) - 0.5) * SPAN_Y,
    0,
  );

  // Walk paths on the grid to build a set of PCB-like traces.
  const PATH_COUNT = 26;
  const PATH_MAX_STEPS = 22;
  const segments = []; // flat array of x1,y1,z1,x2,y2,z2
  const padCoords = []; // list of {cx,cy}
  const DIRS = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
  ];
  for (let p = 0; p < PATH_COUNT; p++) {
    let cx = Math.floor(Math.random() * COLS);
    let cy = Math.floor(Math.random() * ROWS);
    let dir = DIRS[Math.floor(Math.random() * DIRS.length)];
    padCoords.push({ cx, cy });
    const steps = 6 + Math.floor(Math.random() * (PATH_MAX_STEPS - 6));
    for (let s = 0; s < steps; s++) {
      // 30% chance to turn 90° at each step
      if (Math.random() < 0.3) {
        // Pick a perpendicular direction
        const perp = DIRS.filter((d) => (d[0] !== dir[0] || d[1] !== dir[1])
                                     && (d[0] !== -dir[0] || d[1] !== -dir[1]));
        dir = perp[Math.floor(Math.random() * perp.length)];
      }
      const nx = cx + dir[0];
      const ny = cy + dir[1];
      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) {
        // Bounce: reverse direction
        dir = [-dir[0], -dir[1]];
        continue;
      }
      const a = cellToWorld(cx, cy);
      const b = cellToWorld(nx, ny);
      segments.push(a.x, a.y, a.z, b.x, b.y, b.z);
      cx = nx; cy = ny;
      // Occasionally deposit a pad at a turn or endpoint
      if (Math.random() < 0.15) padCoords.push({ cx, cy });
    }
    padCoords.push({ cx, cy });
  }

  // Traces geometry
  const traceGeo = new THREE.BufferGeometry();
  traceGeo.setAttribute('position', new THREE.Float32BufferAttribute(segments, 3));
  const traceMat = new THREE.LineBasicMaterial({
    color: PAL.mint,
    transparent: true,
    opacity: 0.28,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const traces = new THREE.LineSegments(traceGeo, traceMat);
  group.add(traces);
  geoms.push(traceGeo); mats.push(traceMat);

  // Pads — instanced small emissive discs (billboard-ish spheres are fine)
  const padGeo = new THREE.SphereGeometry(0.055, 6, 6);
  const padMat = new THREE.MeshBasicMaterial({
    color: PAL.violet,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const pads = new THREE.InstancedMesh(padGeo, padMat, padCoords.length);
  const tmp = new THREE.Object3D();
  for (let i = 0; i < padCoords.length; i++) {
    const { cx, cy } = padCoords[i];
    const p = cellToWorld(cx, cy);
    tmp.position.set(p.x, p.y, p.z);
    tmp.scale.setScalar(0.7 + Math.random() * 0.9);
    tmp.updateMatrix();
    pads.setMatrixAt(i, tmp.matrix);
  }
  pads.instanceMatrix.needsUpdate = true;
  group.add(pads);
  geoms.push(padGeo); mats.push(padMat);

  function dispose() {
    geoms.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
  }

  return { group, traceMat, padMat, dispose };
}

/* --------------------------------------------------------------------------
   Build the data-flow curves — a handful of Catmull-Rom curves with small
   bright particles flowing along each at different speeds. All curves
   share one Points object (one point per particle), positions rewritten
   each frame. Returns { group, update, dispose }.
   -------------------------------------------------------------------------- */
function buildDataFlow(curveCount = 5, particlesPerCurve = 8) {
  const group = new THREE.Group();
  const geoms = [];
  const mats = [];

  // Build curves that arc through the scene at varying orientations.
  const curves = [];
  for (let c = 0; c < curveCount; c++) {
    const pts = [];
    const seed = c * 1.7 + 0.3;
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      pts.push(new THREE.Vector3(
        Math.sin(seed + t * 3.4) * (3 + c * 0.5) + (Math.random() - 0.5) * 0.6,
        Math.cos(seed * 1.2 + t * 2.6) * (2.4 - c * 0.2) + (Math.random() - 0.5) * 0.4,
        Math.sin(seed * 0.7 + t * 1.8) * 3 - 1 + (Math.random() - 0.5) * 0.5,
      ));
    }
    curves.push(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5));
  }

  const total = curveCount * particlesPerCurve;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(total * 3);
  const colors = new Float32Array(total * 3);
  const cMint = new THREE.Color(PAL.mint);
  const cViolet = new THREE.Color(PAL.violet);
  const cWarm = new THREE.Color(PAL.warm);
  // Per-particle metadata
  const offsets = new Float32Array(total);
  const speeds = new Float32Array(total);
  const curveIdx = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    offsets[i] = Math.random();
    speeds[i] = 0.06 + Math.random() * 0.10;
    curveIdx[i] = i % curveCount;
    const roll = Math.random();
    const col = roll < 0.5
      ? cMint.clone().lerp(cViolet, roll * 2)
      : cViolet.clone().lerp(cWarm, (roll - 0.5) * 2);
    colors[i * 3 + 0] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.11,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const pts = new THREE.Points(geo, mat);
  group.add(pts);
  geoms.push(geo); mats.push(mat);

  function update(dt, progress, time, velocity) {
    const arr = geo.attributes.position.array;
    const speedMul = 1 + velocity * 4;
    for (let i = 0; i < total; i++) {
      const t = (offsets[i] + time * speeds[i] * speedMul) % 1;
      const c = curves[curveIdx[i]];
      const p = c.getPoint(t);
      arr[i * 3 + 0] = p.x;
      arr[i * 3 + 1] = p.y;
      arr[i * 3 + 2] = p.z;
    }
    geo.attributes.position.needsUpdate = true;
    // Slight opacity pulse to feel data-y
    mat.opacity = 0.55 + Math.sin(time * 1.2) * 0.15 + band(progress, 0.55, 0.85) * 0.25;
  }

  function dispose() {
    geoms.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
  }

  return { group, update, dispose };
}

/* --------------------------------------------------------------------------
   Main factory — signature preserved:
     createWebGLScene({canvas, onReady, onProgress}) → {
       setProgress, setVelocity, burst, shockwave, dispose,
       renderer, scene, camera,
     }
   -------------------------------------------------------------------------- */
export function createWebGLScene({ canvas, onReady, onProgress }) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Low-power tier: small viewport or touch-only device. Fill-rate is the
  // main scroll-jank culprit (bloom + additive particles at high DPR), so
  // these devices get smaller particle counts and a lower pixel ratio.
  const isLowPower =
    window.matchMedia('(max-width: 48rem)').matches ||
    window.matchMedia('(pointer: coarse)').matches;
  const DPR_CAP = isLowPower ? 1 : 1.35;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x04040a, 0.05);

  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    100,
  );
  camera.position.set(0, 0, 6);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, DPR_CAP));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // ---- Lighting ---------------------------------------------------------
  const ambient = new THREE.AmbientLight(0x2a3450, 0.7);
  scene.add(ambient);

  const keyLight = new THREE.PointLight(PAL.mint, 2.4, 15, 1.4);
  keyLight.position.set(3, 2, 4);
  scene.add(keyLight);

  const fillLight = new THREE.PointLight(PAL.violet, 1.5, 15, 1.6);
  fillLight.position.set(-3, -1, 3);
  scene.add(fillLight);

  const rimLight = new THREE.PointLight(PAL.warm, 1.0, 12, 1.8);
  rimLight.position.set(0, -3, -2);
  scene.add(rimLight);

  // Cursor-tracking accent point light (warm) — lerps toward a 3D projection
  // of the mouse in world space each frame. Preserved from previous scene.
  const cursorLight = new THREE.PointLight(PAL.warm, 1.6, 10, 1.4);
  cursorLight.position.set(0, 0, 3);
  scene.add(cursorLight);

  // ---- Group root ------------------------------------------------------
  const world = new THREE.Group();
  scene.add(world);

  // ---- Chip die "core" -------------------------------------------------
  const chip = buildChipCore();
  const coreGroup = new THREE.Group();
  coreGroup.add(chip.group);
  world.add(coreGroup);

  // ---- Neural network node graph ---------------------------------------
  const nodeGraph = buildNodeGraph(reduceMotion ? 18 : (isLowPower ? 20 : 30));
  world.add(nodeGraph.group);

  // ---- Floating code glyphs (replaces the old low-poly floaters) -------
  const floaters = [];
  const disposables = [];

  function addGlyph({ kind, from, to, spin, phase, band: b, style = 'solid', color = PAL.violet, emissive = 0x00243a }) {
    const shapes = makeGlyphShape(kind);
    const geo = new THREE.ExtrudeGeometry(shapes, {
      depth: 0.16,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.012,
      bevelSegments: 1,
      curveSegments: 3,
    });
    geo.computeVertexNormals();
    let mat;
    if (style === 'wire') {
      mat = new THREE.MeshBasicMaterial({
        color, wireframe: true, transparent: true, opacity: 0.55,
      });
    } else {
      mat = new THREE.MeshStandardMaterial({
        color,
        metalness: 0.55,
        roughness: 0.35,
        emissive,
        emissiveIntensity: 0.55,
        transparent: true,
        opacity: 0.95,
      });
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(from);
    world.add(mesh);
    floaters.push({ mesh, from, to, spin, phase, band: b, mat });
    disposables.push(geo, mat);
    return mesh;
  }

  // 12 glyphs — a mix of solid and wire styles. Positions/trajectories echo
  // the previous floater choreography so scroll bands line up.
  addGlyph({ kind: '{',  from: new THREE.Vector3(-4.5, 2.0, -2),  to: new THREE.Vector3(4.5, -1.8, -1), spin: new THREE.Vector3(0.35, 0.5, 0.1),  phase: 0.0, band: [0.00, 1.00], color: PAL.mint });
  addGlyph({ kind: '}',  from: new THREE.Vector3(3.8, -2.4, -3),  to: new THREE.Vector3(-3.2, 2.6, 1.5), spin: new THREE.Vector3(0.6, 0.3, 0.2),   phase: 1.3, band: [0.05, 0.95], color: PAL.mint });
  addGlyph({ kind: '<',  from: new THREE.Vector3(-2.5, -3.0, -4), to: new THREE.Vector3(2.8, 3.2, 0.5),  spin: new THREE.Vector3(0.2, 0.7, 0.4),   phase: 2.5, band: [0.10, 1.00], color: PAL.violet });
  addGlyph({ kind: '>',  from: new THREE.Vector3(4.6, 3.2, -5),   to: new THREE.Vector3(-4.0, -2.6, 2), spin: new THREE.Vector3(0.4, 0.15, 0.55), phase: 3.7, band: [0.00, 0.90], color: PAL.mint, style: 'wire' });
  addGlyph({ kind: '/',  from: new THREE.Vector3(-3.6, 3.5, 1),   to: new THREE.Vector3(3.6, -3.2, -3), spin: new THREE.Vector3(0.5, 0.35, 0.25), phase: 4.1, band: [0.08, 0.98], color: PAL.warm });
  addGlyph({ kind: '\\', from: new THREE.Vector3(2.2, 3.4, -1),   to: new THREE.Vector3(-2.4, -3.4, 2), spin: new THREE.Vector3(0.7, 0.5, 0.1),   phase: 5.6, band: [0.15, 0.95], color: PAL.violet, style: 'wire' });
  addGlyph({ kind: ';',  from: new THREE.Vector3(-4.2, -3.0, -1), to: new THREE.Vector3(4.4, 3.0, -2),  spin: new THREE.Vector3(0.25, 0.6, 0.35), phase: 6.2, band: [0.00, 1.00], color: PAL.mint });
  addGlyph({ kind: '()', from: new THREE.Vector3(1.6, -3.4, -4),  to: new THREE.Vector3(-1.6, 3.4, 1.5), spin: new THREE.Vector3(0.45, 0.45, 0.45), phase: 7.0, band: [0.20, 1.00], color: PAL.violet });
  addGlyph({ kind: '[]', from: new THREE.Vector3(-3.2, 0.6, -2),  to: new THREE.Vector3(3.2, -1.6, -1), spin: new THREE.Vector3(0.3, 0.25, 0.6),  phase: 8.1, band: [0.05, 0.95], color: PAL.mint, style: 'wire' });
  addGlyph({ kind: '=',  from: new THREE.Vector3(3.0, -0.4, 0),   to: new THREE.Vector3(-3.0, 2.4, -2), spin: new THREE.Vector3(0.15, 0.5, 0.2),  phase: 9.3, band: [0.10, 1.00], color: PAL.warm });
  addGlyph({ kind: '*',  from: new THREE.Vector3(-1.8, 2.6, -3),  to: new THREE.Vector3(2.6, -2.2, 1.2), spin: new THREE.Vector3(0.55, 0.35, 0.4), phase: 10.5, band: [0.15, 0.98], color: PAL.mint });
  addGlyph({ kind: '#',  from: new THREE.Vector3(2.8, 2.8, -2),   to: new THREE.Vector3(-2.8, -2.8, 0.5), spin: new THREE.Vector3(0.35, 0.55, 0.15), phase: 11.6, band: [0.00, 1.00], color: PAL.violet });

  // ---- Data-stream conduit (repurposed ribbon) -------------------------
  const stream = buildDataStream();
  world.add(stream.mesh);
  stream.mesh.visible = true;
  let ribbonRebuildAcc = 0;

  // ---- Wordmark --------------------------------------------------------
  const wordmark = buildWordmark('TECHNYX', {
    size: 0.68, depth: 0.35, gap: 0.24,
    color: PAL.violet, emissive: 0x00243a,
  });
  wordmark.mesh.position.set(0, 0, -3.5);
  world.add(wordmark.mesh);

  // ---- Circuit-board plane (replaces InstancedMesh dot grid) -----------
  // Skipped on low-power devices — 26 curves × dense sampling is a lot of
  // line geometry to keep updated every frame and it's mostly decorative.
  const circuit = (reduceMotion || isLowPower) ? null : buildCircuitBoard();
  if (circuit) {
    circuit.group.position.set(0, -3.2, -6);
    circuit.group.rotation.x = -Math.PI * 0.15;
    scene.add(circuit.group);
  }

  // ---- Data-flow particles along curves --------------------------------
  const dataFlow = reduceMotion
    ? null
    : buildDataFlow(isLowPower ? 3 : 5, isLowPower ? 5 : 8);
  if (dataFlow) world.add(dataFlow.group);

  // ---- Atmospheric particle field --------------------------------------
  // Additive Points at high counts are fill-rate-bound and were the main
  // source of scroll jank at the previous count (4200).
  const PARTICLE_COUNT = reduceMotion ? 0 : (isLowPower ? 1200 : 2000);
  const particleGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const speeds = new Float32Array(PARTICLE_COUNT);
  const colorA = new THREE.Color(PAL.mint);
  const colorB = new THREE.Color(PAL.violet);
  const colorC = new THREE.Color(PAL.warm); // warm cream — third particle tint

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const r = 4 + Math.random() * 10;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi) * 0.6 - 2;

    const t = Math.random();
    const c = t < 0.5
      ? colorA.clone().lerp(colorB, t * 2)
      : colorB.clone().lerp(colorC, (t - 0.5) * 2);
    colors[i * 3 + 0] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;

    speeds[i] = 0.4 + Math.random() * 1.2;
  }
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const particleMat = new THREE.PointsMaterial({
    size: 0.035,
    vertexColors: true,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const particles = new THREE.Points(particleGeo, particleMat);
  scene.add(particles);

  // ---- HUD-style gold grid floor ---------------------------------------
  const grid = new THREE.GridHelper(30, 30, PAL.mint, 0x0f1527);
  grid.material.transparent = true;
  grid.material.opacity = 0.28;
  grid.material.blending = THREE.AdditiveBlending;
  grid.material.depthWrite = false;
  grid.rotation.x = Math.PI * 0.42;
  grid.position.y = -3.5;
  grid.position.z = -5;
  scene.add(grid);

  // ---- Burst particle system (preserved) -------------------------------
  const BURST_MAX = reduceMotion ? 0 : (isLowPower ? 180 : 260);
  const burstGeo = new THREE.BufferGeometry();
  const burstPositions = new Float32Array(BURST_MAX * 3);
  const burstVelocities = new Float32Array(BURST_MAX * 3);
  const burstColors = new Float32Array(BURST_MAX * 3);
  const burstLife = new Float32Array(BURST_MAX);
  burstGeo.setAttribute('position', new THREE.BufferAttribute(burstPositions, 3));
  burstGeo.setAttribute('color', new THREE.BufferAttribute(burstColors, 3));
  const burstMat = new THREE.PointsMaterial({
    size: 0.09,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const burstPoints = new THREE.Points(burstGeo, burstMat);
  scene.add(burstPoints);

  // Section-tinted burst colours — recoloured to fit the IT palette.
  const SECTION_COLORS = {
    hero:         new THREE.Color(PAL.mint),
    audience:     new THREE.Color(PAL.mint),
    stats:        new THREE.Color(PAL.violet),
    services:     new THREE.Color(PAL.violet),
    industries:   new THREE.Color(PAL.mint),
    platforms:    new THREE.Color(PAL.violet),
    pillars:      new THREE.Color(PAL.warm),
    testimonials: new THREE.Color(PAL.violet),
    cta:          new THREE.Color(PAL.mint),
    shockwave:    new THREE.Color(0xffe28a),
  };

  let burstCursor = 0;
  function emitBurst(section, count = 60, speedMul = 1) {
    if (BURST_MAX === 0) return;
    const color = SECTION_COLORS[section] || SECTION_COLORS.hero;
    for (let i = 0; i < count; i++) {
      const idx = burstCursor % BURST_MAX;
      burstCursor++;
      burstPositions[idx * 3 + 0] = (Math.random() - 0.5) * 0.4;
      burstPositions[idx * 3 + 1] = (Math.random() - 0.5) * 0.4;
      burstPositions[idx * 3 + 2] = (Math.random() - 0.5) * 0.4;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = (1.4 + Math.random() * 2.2) * speedMul;
      burstVelocities[idx * 3 + 0] = Math.sin(phi) * Math.cos(theta) * speed;
      burstVelocities[idx * 3 + 1] = Math.sin(phi) * Math.sin(theta) * speed;
      burstVelocities[idx * 3 + 2] = Math.cos(phi) * speed * 0.6;
      burstColors[idx * 3 + 0] = color.r;
      burstColors[idx * 3 + 1] = color.g;
      burstColors[idx * 3 + 2] = color.b;
      burstLife[idx] = 1;
    }
    burstGeo.attributes.position.needsUpdate = true;
    burstGeo.attributes.color.needsUpdate = true;
  }
  function burst(section) { emitBurst(section, isLowPower ? 32 : 48, 1); }
  function shockwave() { emitBurst('shockwave', isLowPower ? 80 : 110, 1.7); }

  function onClick(e) {
    shockwave();
  }
  window.addEventListener('click', onClick);

  // ---- State ------------------------------------------------------------
  const state = {
    progress: 0,
    target:   0,
    velocity: 0,
    velTarget: 0,
    mouse:    new THREE.Vector2(0, 0),
    mouseSmooth: new THREE.Vector2(0, 0),
    time:     0,
    visible:  true,
    running:  true,
    cursorWorld: new THREE.Vector3(0, 0, 0),
    cursorLightPos: new THREE.Vector3(0, 0, 3),
    camAzimuth: 0,
    camElevation: 0,
    camAzimuthTarget: 0,
    camElevationTarget: 0,
  };

  // ---- Handlers ---------------------------------------------------------
  function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, DPR_CAP));
    if (composer) composer.setSize(w, h);
  }

  const raycastPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 2);
  const ndc = new THREE.Vector3();
  const rayOrigin = new THREE.Vector3();
  const rayDir = new THREE.Vector3();
  const hitPoint = new THREE.Vector3();

  function onPointerMove(e) {
    state.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    state.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    state.camAzimuthTarget = state.mouse.x * 0.35;
    state.camElevationTarget = state.mouse.y * 0.25;

    ndc.set(state.mouse.x, state.mouse.y, 0.5);
    ndc.unproject(camera);
    rayOrigin.copy(camera.position);
    rayDir.copy(ndc).sub(rayOrigin).normalize();
    const denom = raycastPlane.normal.dot(rayDir);
    if (Math.abs(denom) > 1e-4) {
      const t = -(raycastPlane.normal.dot(rayOrigin) + raycastPlane.constant) / denom;
      if (t > 0) {
        hitPoint.copy(rayOrigin).add(rayDir.multiplyScalar(t));
        state.cursorWorld.copy(hitPoint);
      }
    }
  }

  function onVisibility() {
    state.visible = document.visibilityState === 'visible';
  }

  window.addEventListener('resize', onResize);
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);

  // ---- Post-processing --------------------------------------------------
  let composer = null;
  let renderPass = null;
  let bloomPass = null;
  let outputPass = null;
  const bloomEnabled = !reduceMotion;
  if (bloomEnabled) {
    try {
      composer = new EffectComposer(renderer);
      composer.setPixelRatio(Math.min(window.devicePixelRatio, DPR_CAP));
      composer.setSize(window.innerWidth, window.innerHeight);
      renderPass = new RenderPass(scene, camera);
      composer.addPass(renderPass);
      bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.22, // strength — kept low so text over the scene stays readable
        0.55, // radius
        0.75, // threshold — only clearly-bright pixels bloom
      );
      composer.addPass(bloomPass);
      outputPass = new OutputPass();
      composer.addPass(outputPass);
    } catch (err) {
      console.warn('Postprocessing setup failed — falling back to direct render.', err);
      composer = null;
    }
  }

  // ---- Public API -------------------------------------------------------
  function setProgress(p) {
    state.target = Math.max(0, Math.min(1, p));
    if (typeof onProgress === 'function') onProgress(state.target);
  }

  function setVelocity(v) {
    state.velTarget = Math.max(0, Math.min(1, v));
  }

  function dispose() {
    state.running = false;
    window.removeEventListener('resize', onResize);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('click', onClick);
    document.removeEventListener('visibilitychange', onVisibility);
    renderer.dispose();
    // Chip die
    chip.dispose();
    // Node graph
    nodeGraph.dispose();
    // Data-stream conduit
    stream.dispose();
    // Wordmark
    wordmark.dispose();
    // Circuit board
    if (circuit) circuit.dispose();
    // Data-flow curves
    if (dataFlow) dataFlow.dispose();
    // Atmospheric particles
    particleGeo.dispose();
    particleMat.dispose();
    // Burst
    burstGeo.dispose();
    burstMat.dispose();
    // Grid floor
    grid.geometry.dispose();
    grid.material.dispose();
    // Glyphs
    disposables.forEach((d) => { if (d && d.dispose) d.dispose(); });
    // Composer
    if (composer) {
      if (bloomPass && bloomPass.dispose) bloomPass.dispose();
      if (outputPass && outputPass.dispose) outputPass.dispose();
      composer.renderTarget1 && composer.renderTarget1.dispose();
      composer.renderTarget2 && composer.renderTarget2.dispose();
    }
  }

  // ---- Animation loop --------------------------------------------------
  const clock = new THREE.Clock();

  // Camera waypoints (10 stops) — preserved verbatim.
  const WAYPOINTS = [
    { p: new THREE.Vector3( 0.0,  0.0,  6.0), l: new THREE.Vector3( 0.0,  0.0,  0.0) },
    { p: new THREE.Vector3(-1.8,  0.4,  5.2), l: new THREE.Vector3( 0.0, -0.2,  0.0) },
    { p: new THREE.Vector3( 1.4,  2.2,  4.6), l: new THREE.Vector3( 0.0, -0.6, -0.4) },
    { p: new THREE.Vector3(-0.4, -0.6,  2.8), l: new THREE.Vector3( 0.4, -0.9, -2.0) },
    { p: new THREE.Vector3( 3.0, -1.4,  3.6), l: new THREE.Vector3(-0.6, -1.2, -0.6) },
    { p: new THREE.Vector3(-2.6, -1.8,  3.8), l: new THREE.Vector3( 0.4, -1.4, -0.4) },
    { p: new THREE.Vector3( 1.6, -0.4,  1.6), l: new THREE.Vector3(-0.4, -0.2, -2.4) },
    { p: new THREE.Vector3(-1.0, -1.2,  4.4), l: new THREE.Vector3( 0.0,  0.6,  0.0) },
    { p: new THREE.Vector3( 2.0, -0.6,  5.0), l: new THREE.Vector3(-0.6, -0.4, -0.2) },
    { p: new THREE.Vector3( 0.0, -0.2,  3.4), l: new THREE.Vector3( 0.0,  0.0,  0.0) },
  ];

  const tmpPos = new THREE.Vector3();
  const tmpLook = new THREE.Vector3();
  const tmpOffset = new THREE.Vector3();

  function sampleWaypoint(target, list, key, t) {
    const n = list.length - 1;
    const scaled = t * n;
    const i = Math.min(Math.floor(scaled), n - 1);
    const f = scaled - i;
    const smoothF = f * f * (3 - 2 * f);
    target.lerpVectors(list[i][key], list[i + 1][key], smoothF);
  }

  let frameCount = 0;

  function tick() {
    if (!state.running) return;
    requestAnimationFrame(tick);
    if (!state.visible) return;
    frameCount++;

    const dt = Math.min(clock.getDelta(), 0.05);
    state.time += dt;

    // Ease scroll progress + velocity
    state.progress += (state.target - state.progress) * 0.08;
    state.velocity += (state.velTarget - state.velocity) * 0.15;

    // Ease mouse
    state.mouseSmooth.x += (state.mouse.x - state.mouseSmooth.x) * 0.06;
    state.mouseSmooth.y += (state.mouse.y - state.mouseSmooth.y) * 0.06;
    state.camAzimuth += (state.camAzimuthTarget - state.camAzimuth) * 0.05;
    state.camElevation += (state.camElevationTarget - state.camElevation) * 0.05;

    const mx = state.mouseSmooth.x;
    const my = state.mouseSmooth.y;
    const p  = state.progress;
    const vel = state.velocity;

    // ---- Camera dolly + mouse orbit + velocity shake (preserved) -----
    sampleWaypoint(tmpPos,  WAYPOINTS, 'p', p);
    sampleWaypoint(tmpLook, WAYPOINTS, 'l', p);

    tmpOffset.copy(tmpPos).sub(tmpLook);
    const radius = tmpOffset.length();
    let azimuth = Math.atan2(tmpOffset.x, tmpOffset.z) + state.camAzimuth;
    let elevation = Math.asin(THREE.MathUtils.clamp(tmpOffset.y / radius, -1, 1)) + state.camElevation;
    elevation = THREE.MathUtils.clamp(elevation, -1.3, 1.3);
    tmpOffset.set(
      Math.cos(elevation) * Math.sin(azimuth) * radius,
      Math.sin(elevation) * radius,
      Math.cos(elevation) * Math.cos(azimuth) * radius,
    );
    tmpPos.copy(tmpLook).add(tmpOffset);

    const shake = vel * 0.12;
    tmpPos.x += (Math.random() - 0.5) * shake;
    tmpPos.y += (Math.random() - 0.5) * shake;

    camera.position.copy(tmpPos);
    camera.lookAt(tmpLook);

    // Dynamic fog — thickens as we scroll deeper AND with velocity spikes
    scene.fog.density = 0.05 + p * 0.03 + vel * 0.04;

    // ---- Cursor-tracking accent light (preserved) --------------------
    state.cursorLightPos.lerp(state.cursorWorld, 0.12);
    cursorLight.position.copy(state.cursorLightPos);
    cursorLight.intensity = 2.0 + Math.sin(state.time * 2.4) * 0.4 + vel * 1.5;

    // ---- Chip core: slow rotation + subtle scale pulse ----
    // Full 720° across scroll like the previous core, plus idle drift.
    coreGroup.rotation.x = state.time * 0.10 + p * Math.PI * 4;
    coreGroup.rotation.y = state.time * 0.14 + p * Math.PI * 4;
    coreGroup.position.x = -p * 3.5;
    coreGroup.position.y = Math.sin(p * Math.PI) * 0.4;
    const coreScale = 1 + Math.sin(state.time * 0.6) * 0.02 - p * 0.15;
    coreGroup.scale.setScalar(coreScale);

    // Pulse the die's emissive intensity — feels "alive".
    chip.dieMat.emissiveIntensity = 0.55 + Math.sin(state.time * 1.6) * 0.25;
    chip.traceMat.opacity = 0.45 + Math.sin(state.time * 2.2 + 0.7) * 0.15;
    // At CTA convergence, boost body emissive slightly for finale energy.
    chip.bodyMat.emissiveIntensity = 0.4 + band(p, 0.85, 1.0) * 0.4;

    // ---- Node graph: gentle rotation + pulses along edges ----
    nodeGraph.group.rotation.y = state.time * 0.06 + p * Math.PI * 0.8;
    nodeGraph.group.rotation.x = Math.sin(p * Math.PI) * 0.2 + my * 0.1;
    // Graph most prominent 15-60%, hangs back afterwards but never fully gone.
    const graphShow = 0.45 + band(p, 0.05, 0.4) * 0.55 - band(p, 0.85, 1.0) * 0.4;
    nodeGraph.group.scale.setScalar(0.9 + graphShow * 0.25);
    nodeGraph.update(dt, p, state.time, vel);

    // ---- Code glyphs: per-object scroll-driven trajectory + idle drift ----
    floaters.forEach((f, i) => {
      const [bandA, bandB] = f.band;
      const inBand = band(p, bandA, Math.min(bandA + 0.15, bandB));
      const outBand = 1 - band(p, Math.max(bandB - 0.15, bandA), bandB);
      const sweep = smooth(THREE.MathUtils.clamp((p - 0.1) / 0.75, 0, 1));
      f.mesh.position.lerpVectors(f.from, f.to, sweep);
      const t = state.time + f.phase;
      f.mesh.position.x += Math.sin(t * 0.6) * 0.35;
      f.mesh.position.y += Math.cos(t * 0.55) * 0.35;
      f.mesh.position.z += Math.sin(t * 0.45 + 1.7) * 0.25;
      // Industries band swirl (0.38-0.55).
      const swirl = band(p, 0.38, 0.55) * invband(p, 0.58, 0.70);
      if (swirl > 0.001) {
        const angle = t * 0.6 + i * 0.9 + p * Math.PI * 2;
        const rad = 1.6 + i * 0.25;
        const spiralX = Math.cos(angle) * rad;
        const spiralY = Math.sin(angle) * rad * 0.6 - 0.4;
        const spiralZ = Math.sin(angle * 0.7) * 1.2 - 1.2;
        f.mesh.position.x = THREE.MathUtils.lerp(f.mesh.position.x, spiralX, swirl);
        f.mesh.position.y = THREE.MathUtils.lerp(f.mesh.position.y, spiralY, swirl);
        f.mesh.position.z = THREE.MathUtils.lerp(f.mesh.position.z, spiralZ, swirl);
      }
      // CTA convergence — pull toward the core.
      const converge = band(p, 0.85, 1.0);
      if (converge > 0.001) {
        f.mesh.position.multiplyScalar(1 - converge * 0.85);
      }
      f.mesh.rotation.x += f.spin.x * dt;
      f.mesh.rotation.y += f.spin.y * dt;
      f.mesh.rotation.z += f.spin.z * dt;
      const s = Math.max(0, inBand * outBand);
      // Glyphs are a bit smaller than the old floaters — scale up a touch.
      f.mesh.scale.setScalar(s * 1.15);
      if (f.mat && f.mat.transparent) {
        f.mat.opacity = Math.max(0.05, s * (f.mat.userData.baseOpacity || 0.9));
        if (!f.mat.userData.baseOpacity) f.mat.userData.baseOpacity = f.mat.opacity;
      }
    });

    // ---- Data-stream conduit: rebuild curve occasionally, scanline shader ----
    ribbonRebuildAcc += dt;
    const streamShow = band(p, 0.10, 0.30) * (1 - band(p, 0.90, 1.0));
    stream.mesh.visible = streamShow > 0.01;
    if (stream.mesh.visible && ribbonRebuildAcc > 0.10) {
      stream.rebuild(p, state.time);
      ribbonRebuildAcc = 0;
    }
    stream.mesh.rotation.y = p * Math.PI * 1.5 + state.time * 0.08;
    stream.mesh.rotation.x = Math.sin(p * Math.PI) * 0.35;
    stream.mesh.scale.setScalar(0.6 + streamShow * 0.6);
    const streamMat = stream.getMaterial();
    if (streamMat && streamMat.userData.shader) {
      streamMat.userData.shader.uniforms.uTime.value = state.time;
      // Speed up packet scroll with velocity + platforms band.
      streamMat.userData.shader.uniforms.uSpeed.value = 1.2 + band(p, 0.55, 0.85) * 1.4 + vel * 2.0;
    }
    if (streamMat) {
      streamMat.opacity = 0.15 + streamShow * 0.85;
      streamMat.emissiveIntensity = 0.3 + band(p, 0.55, 0.80) * 0.8;
    }

    // ---- Wordmark: same 18-70% window, terminal scanline shader ----
    const wmIn = band(p, 0.18, 0.32);
    const wmOut = 1 - band(p, 0.60, 0.75);
    const wmScale = wmIn * wmOut;
    wordmark.mesh.visible = wmScale > 0.005;
    if (wordmark.mesh.visible) {
      const wildIn = (1 - wmIn) * 3.0;
      const wildOut = (1 - wmOut) * 3.0;
      wordmark.mesh.rotation.x = state.time * 0.25 + wildIn + wildOut;
      wordmark.mesh.rotation.y = state.time * 0.35 + wildIn * 1.4 - wildOut * 1.2;
      wordmark.mesh.rotation.z = Math.sin(state.time * 0.5) * 0.15 + wildIn * 0.5;
      wordmark.mesh.scale.setScalar(wmScale * 1.35);
      wordmark.mesh.position.x = -p * 1.2;
      wordmark.mesh.position.y = 0.2 + Math.sin(state.time * 0.6) * 0.15 - p * 0.4;
      wordmark.mesh.position.z = -3.5 + (1 - wmIn) * -3 + p * 1.8;
      const wmMat = wordmark.getMaterial();
      wmMat.emissiveIntensity = 0.5 + Math.sin(state.time * 1.8) * 0.3 + wmScale * 0.4;
      if (wmMat.userData.shader) {
        wmMat.userData.shader.uniforms.uTime.value = state.time;
      }
    }

    // ---- Circuit-board plane: pitch on scroll ----
    if (circuit) {
      circuit.group.rotation.x = -0.15 - p * 1.0;
      circuit.group.position.y = -3.2 + p * 1.5;
      circuit.group.rotation.y = mx * 0.15 + state.time * 0.02;
      circuit.traceMat.opacity = 0.30 + Math.sin(state.time * 0.8) * 0.06 - p * 0.08;
      circuit.padMat.opacity = 0.50 + Math.sin(state.time * 1.4) * 0.15 - p * 0.1;
    }

    // ---- Data-flow curve particles ----
    if (dataFlow) {
      dataFlow.update(dt, p, state.time, vel);
      dataFlow.group.rotation.y = state.time * 0.04 + p * Math.PI * 0.6;
    }

    // ---- Atmospheric particles ----
    particles.rotation.y = state.time * 0.03;
    particles.rotation.x = -p * 0.4 + my * 0.05;
    particles.rotation.z = mx * 0.05;
    particleMat.size = 0.035 + Math.sin(state.time * 0.9) * 0.005;
    particleMat.opacity = 0.75 - p * 0.2;

    // ---- Lights ----
    keyLight.position.x = Math.sin(state.time * 0.4) * 3;
    keyLight.position.y = Math.cos(state.time * 0.35) * 2 + 1;
    fillLight.intensity = 1.5 + p * 0.6;
    rimLight.intensity = 1.0 + Math.sin(state.time * 0.8) * 0.25;

    // ---- Bloom peaks at CTA (kept modest so text stays legible) ----
    if (bloomPass) {
      bloomPass.strength = 0.2 + band(p, 0.75, 1.0) * 0.45 + vel * 0.12;
    }

    // ---- Grid floor ----
    grid.position.z = -5 + p * 3;
    grid.material.opacity = 0.28 - p * 0.15;

    // ---- Burst particles: simulate life + integrate positions ----
    if (BURST_MAX > 0) {
      let anyAlive = false;
      for (let i = 0; i < BURST_MAX; i++) {
        if (burstLife[i] <= 0) continue;
        burstLife[i] -= dt * 0.9;
        if (burstLife[i] < 0) burstLife[i] = 0;
        anyAlive = true;
        burstPositions[i * 3 + 0] += burstVelocities[i * 3 + 0] * dt;
        burstPositions[i * 3 + 1] += burstVelocities[i * 3 + 1] * dt;
        burstPositions[i * 3 + 2] += burstVelocities[i * 3 + 2] * dt;
        burstVelocities[i * 3 + 0] *= 0.96;
        burstVelocities[i * 3 + 1] *= 0.96;
        burstVelocities[i * 3 + 2] *= 0.96;
        const life = burstLife[i];
        burstColors[i * 3 + 0] *= 0.995;
        burstColors[i * 3 + 1] *= 0.995;
        burstColors[i * 3 + 2] *= 0.995;
        if (life <= 0) {
          burstPositions[i * 3 + 0] = 999;
          burstPositions[i * 3 + 1] = 999;
          burstPositions[i * 3 + 2] = 999;
        }
      }
      if (anyAlive) {
        burstGeo.attributes.position.needsUpdate = true;
        burstGeo.attributes.color.needsUpdate = true;
      }
    }

    if (composer) {
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
  }

  // ---- Kick off ---------------------------------------------------------
  onResize();
  requestAnimationFrame(() => {
    if (typeof onReady === 'function') onReady();
    tick();
  });

  return { setProgress, setVelocity, burst, shockwave, dispose, renderer, scene, camera };
}
