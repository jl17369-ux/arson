/* ── ARSON ART — script.js ───────────────────────── */

const bgCanvas   = document.getElementById('bg-canvas');
const mainCanvas = document.getElementById('main-canvas');
const bgCtx      = bgCanvas.getContext('2d');
const mainCtx    = mainCanvas.getContext('2d', { willReadFrequently: false });

const flameCursor   = document.getElementById('flame-cursor');
const canvasWrapper = document.getElementById('canvas-wrapper');

// Controls
const radiusSlider    = document.getElementById('brush-radius');
const intensitySlider = document.getElementById('flame-intensity');
const precisionSlider = document.getElementById('flame-precision');
const radiusVal       = document.getElementById('radius-val');
const intensityVal    = document.getElementById('intensity-val');
const precisionVal    = document.getElementById('precision-val');
const bgColorPicker   = document.getElementById('bg-color-picker');
const btnBgTransparent = document.getElementById('btn-bg-transparent');
const btnClear        = document.getElementById('btn-clear');

// State
let isDrawing    = false;
let lastX        = null;
let lastY        = null;
let brushRadius  = 20;
let flameIntensity = 0.70;
let flamePrecision = 5;
let bgColor      = null;   // null = transparent

/* ─────────────────────────────────────────────────
   Canvas Init & Resize
───────────────────────────────────────────────── */
function initCanvases() {
  const w = canvasWrapper.clientWidth;
  const h = canvasWrapper.clientHeight;

  bgCanvas.width    = w;
  bgCanvas.height   = h;
  mainCanvas.width  = w;
  mainCanvas.height = h;

  // Main canvas = white paper
  mainCtx.fillStyle = '#ffffff';
  mainCtx.fillRect(0, 0, w, h);

  // Background canvas = fill with colour if set
  bgCtx.clearRect(0, 0, w, h);
  if (bgColor) {
    bgCtx.fillStyle = bgColor;
    bgCtx.fillRect(0, 0, w, h);
  }
}

// On window resize: resize canvases (this resets art — by design for MVP)
window.addEventListener('resize', () => {
  initCanvases();
});

/* ─────────────────────────────────────────────────
   Burn Effect
───────────────────────────────────────────────── */

/**
 * Apply a single burn stamp at (x, y).
 *
 * The effect has two passes on the MAIN canvas:
 *   1. Multiply-darken: char marks + ember glow drawn INTO the white paper
 *   2. Destination-out: cut a transparent hole through the paper
 *
 * This order means char marks appear around the hole edge,
 * not floating over the transparent background.
 */
function burn(x, y) {
  const r  = brushRadius;
  const iv = flameIntensity;         // 0..1
  const pr = flamePrecision / 10.0;  // 0.1..1.0  (1 = most precise/clean)

  /* ── PASS 1: Char + ember ring (multiply blend onto white) ── */
  const charR = r * 1.65;

  // Slight randomness for organic edges when precision is low
  const jitter = (1 - pr) * r * 0.18;
  const jx = x + (Math.random() - 0.5) * jitter * 2;
  const jy = y + (Math.random() - 0.5) * jitter * 2;

  const emberGrad = mainCtx.createRadialGradient(jx, jy, 0, jx, jy, charR);
  // Deep char center (nearly black)
  emberGrad.addColorStop(0.00, `rgba(4, 2, 0,  ${0.97 * iv})`);
  emberGrad.addColorStop(0.20, `rgba(10, 4, 0,  ${0.93 * iv})`);
  // Transition to live ember orange
  emberGrad.addColorStop(0.42, `rgba(220, 80,  5, ${0.88 * iv})`);
  emberGrad.addColorStop(0.55, `rgba(255, 140, 10, ${0.75 * iv})`);
  // Outer char / singeing
  emberGrad.addColorStop(0.68, `rgba(90,  25,  0, ${0.60 * iv})`);
  emberGrad.addColorStop(0.80, `rgba(30,   8,  0, ${0.35 * iv})`);
  emberGrad.addColorStop(1.00, `rgba(0,    0,  0, 0)`);

  mainCtx.save();
  mainCtx.globalCompositeOperation = 'multiply';
  mainCtx.fillStyle = emberGrad;
  mainCtx.beginPath();
  mainCtx.arc(jx, jy, charR, 0, Math.PI * 2);
  mainCtx.fill();
  mainCtx.restore();

  // Extra scattered embers at low precision
  if (pr < 0.6) {
    const scatterCount = Math.floor((1 - pr) * 5);
    for (let i = 0; i < scatterCount; i++) {
      const angle  = Math.random() * Math.PI * 2;
      const dist   = (0.5 + Math.random() * 0.6) * r;
      const ex     = x + Math.cos(angle) * dist;
      const ey     = y + Math.sin(angle) * dist;
      const er     = r * (0.06 + Math.random() * 0.14);
      const sGrad  = mainCtx.createRadialGradient(ex, ey, 0, ex, ey, er);
      sGrad.addColorStop(0.0, `rgba(255, 180, 20, ${0.7 * iv})`);
      sGrad.addColorStop(0.6, `rgba(200,  60,  5, ${0.4 * iv})`);
      sGrad.addColorStop(1.0, `rgba(0, 0, 0, 0)`);
      mainCtx.save();
      mainCtx.globalCompositeOperation = 'multiply';
      mainCtx.fillStyle = sGrad;
      mainCtx.beginPath();
      mainCtx.arc(ex, ey, er, 0, Math.PI * 2);
      mainCtx.fill();
      mainCtx.restore();
    }
  }

  /* ── PASS 2: Cut the burn-hole through the paper ── */
  // softEdge: how gradual the transparency falls off at edge (0=hard, 1=soft)
  const softEdge = 1.0 - pr * 0.75;   // low precision → softer / raggedier hole
  const innerR   = r * (0.55 + pr * 0.35); // inner solid zone

  const cutGrad = mainCtx.createRadialGradient(x, y, innerR * 0.3, x, y, r);
  cutGrad.addColorStop(0.00, `rgba(0,0,0, 1)`);
  cutGrad.addColorStop(Math.min(0.95, innerR / r), `rgba(0,0,0, 0.98)`);
  cutGrad.addColorStop(1.00, `rgba(0,0,0, ${softEdge * 0.35})`);

  mainCtx.save();
  mainCtx.globalCompositeOperation = 'destination-out';
  mainCtx.fillStyle = cutGrad;
  mainCtx.beginPath();
  mainCtx.arc(x, y, r, 0, Math.PI * 2);
  mainCtx.fill();
  mainCtx.restore();
}

/**
 * Interpolate burn stamps along a drag path so there are no gaps.
 * Step = fraction of brush radius for smooth coverage.
 */
function burnLine(x0, y0, x1, y1) {
  const dx   = x1 - x0;
  const dy   = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const step = Math.max(1, brushRadius * 0.28);
  const n    = Math.ceil(dist / step);

  for (let i = 0; i <= n; i++) {
    const t = n === 0 ? 0 : i / n;
    burn(x0 + dx * t, y0 + dy * t);
  }
}

/* ─────────────────────────────────────────────────
   Pointer Events
───────────────────────────────────────────────── */
function getPos(e) {
  const rect = mainCanvas.getBoundingClientRect();
  const scaleX = mainCanvas.width  / rect.width;
  const scaleY = mainCanvas.height / rect.height;
  const cx = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
  const cy = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
  return {
    x: (cx - rect.left) * scaleX,
    y: (cy - rect.top)  * scaleY,
    cx, cy
  };
}

function moveCursor(cx, cy) {
  flameCursor.style.left = cx + 'px';
  flameCursor.style.top  = cy + 'px';
}

mainCanvas.addEventListener('mouseenter', () => {
  flameCursor.style.display = 'block';
});
mainCanvas.addEventListener('mouseleave', () => {
  flameCursor.style.display = 'none';
  isDrawing = false;
  lastX = lastY = null;
});

mainCanvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  isDrawing = true;
  const { x, y, cx, cy } = getPos(e);
  moveCursor(cx, cy);
  burn(x, y);
  lastX = x; lastY = y;
});

mainCanvas.addEventListener('mousemove', (e) => {
  const { x, y, cx, cy } = getPos(e);
  moveCursor(cx, cy);
  if (!isDrawing) return;
  burnLine(lastX, lastY, x, y);
  lastX = x; lastY = y;
});

window.addEventListener('mouseup', () => {
  isDrawing = false;
  lastX = lastY = null;
});

// Touch support
mainCanvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  isDrawing = true;
  const { x, y } = getPos(e);
  burn(x, y);
  lastX = x; lastY = y;
}, { passive: false });

mainCanvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const { x, y } = getPos(e);
  if (!isDrawing) return;
  burnLine(lastX, lastY, x, y);
  lastX = x; lastY = y;
}, { passive: false });

mainCanvas.addEventListener('touchend', () => {
  isDrawing = false;
  lastX = lastY = null;
});

/* ─────────────────────────────────────────────────
   Control Listeners
───────────────────────────────────────────────── */
function updateSliderTrack(input) {
  const min = +input.min, max = +input.max, val = +input.value;
  const pct = ((val - min) / (max - min) * 100).toFixed(1) + '%';
  input.style.setProperty('--pct', pct);
}

radiusSlider.addEventListener('input', () => {
  brushRadius = +radiusSlider.value;
  radiusVal.textContent = brushRadius;
  updateSliderTrack(radiusSlider);
});

intensitySlider.addEventListener('input', () => {
  flameIntensity = +intensitySlider.value / 100;
  intensityVal.textContent = intensitySlider.value + '%';
  updateSliderTrack(intensitySlider);
});

precisionSlider.addEventListener('input', () => {
  flamePrecision = +precisionSlider.value;
  precisionVal.textContent = flamePrecision;
  updateSliderTrack(precisionSlider);
});

bgColorPicker.addEventListener('input', () => {
  bgColor = bgColorPicker.value;
  bgCtx.fillStyle = bgColor;
  bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
});

btnBgTransparent.addEventListener('click', () => {
  bgColor = null;
  bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
});

btnClear.addEventListener('click', () => {
  // Re-fill main canvas with white
  mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
  mainCtx.fillStyle = '#ffffff';
  mainCtx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
});

/* ─────────────────────────────────────────────────
   Boot
───────────────────────────────────────────────── */
[radiusSlider, intensitySlider, precisionSlider].forEach(updateSliderTrack);
initCanvases();