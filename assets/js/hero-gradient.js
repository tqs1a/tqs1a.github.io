/**
 * Hero-Gradient: rohes WebGL (kein Three.js).
 *
 * Ein einziges Fullscreen-Dreieck, der Fragment-Shader zeichnet ein schräges,
 * wellenförmiges Farbband aus domain-warped Simplex-Noise.
 *
 * Zustände (stehen zum Testen in data-state am .hero__bg):
 *   css      – reiner CSS-Fallback (Start, kein WebGL, Kontextverlust, zu langsam)
 *   webgl    – animierter Shader
 *   static   – ein einzelnes Shader-Frame (prefers-reduced-motion)
 *
 * Testhilfen: ?hero=css erzwingt den Fallback, ?hero=slow simuliert ein
 * langsames Gerät (30 ms Last pro Frame) und muss auf CSS zurückfallen.
 */

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
// highp ist im Fragment-Shader unter WebGL 1 optional; ältere Mobil-GPUs
// bekommen mediump statt eines Kompilierfehlers.
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2  uResolution;
uniform float uTime;
uniform vec2  uPointer;   // -1..1, stark geglättet
uniform float uScroll;    // 0..1 Fortschritt durch den Hero
uniform vec3  uC1;        // Violett  #635BFF
uniform vec3  uC2;        // Cyan     #00D4FF
uniform vec3  uC3;        // Pink     #FF6BB5
uniform vec3  uC4;        // Hellviolett #9089FC

// --- 3D-Simplex-Noise (Ashima Arts / Stefan Gustavson, MIT-Lizenz) --------
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// Billiger Hash für das Dither-Rauschen
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

const float TAU = 6.28318530718;

void main() {
  // Koordinaten in Einheiten der kürzeren Bildschirmseite, Ursprung in der Mitte.
  // So bleibt die Bandbreite auf Hochformat und 21:9 gleich proportioniert.
  float minRes = min(uResolution.x, uResolution.y);
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution) / minRes;
  float halfH = 0.5 * uResolution.y / minRes;   // 0.5 im Querformat, größer im Hochformat

  // Sehr dezente Reaktion auf Maus und Scroll
  p += uPointer * vec2(0.025, 0.018);
  p.y -= uScroll * 0.12;

  // Band um ca. 12° neigen (steigt nach rechts an): q.x läuft entlang des Bands
  const float A = 0.2094;  // 12° in Radiant
  mat2 rot = mat2(cos(A), sin(A), -sin(A), cos(A));
  vec2 q = rot * p;

  // Langsame Zeitachsen. Volle Wellenperiode: 26 s bzw. noch langsamer.
  float t = uTime;
  float slow = t * 0.035;

  // Domain Warping: Noise verschiebt die Koordinaten, auf denen wieder Noise liegt
  vec2 w1 = vec2(snoise(vec3(q * 0.85, slow)),
                 snoise(vec3(q * 0.85 + vec2(7.3, 1.7), slow)));
  vec2 w2 = vec2(snoise(vec3(q * 1.5 + w1 * 0.7, slow * 1.3 + 3.1)),
                 snoise(vec3(q * 1.5 + w1 * 0.7 + vec2(11.7, 4.2), slow * 1.3)));
  vec2 qw = q + 0.12 * w2;

  // Welle des Bands (Periode 26 s und 41 s überlagert)
  float wave = 0.075 * sin(qw.x * 2.1 + t * TAU / 26.0)
             + 0.045 * sin(qw.x * 3.7 - t * TAU / 41.0 + 1.3);

  // Bandmitte: im Hochformat etwas nach oben, damit Text unten ruhiger liegt
  float center = 0.09 + max(halfH - 0.5, 0.0) * 0.45;
  float d = qw.y - center - wave;

  // Weicher Verlauf nach oben und unten in Weiß; Band oben etwas schmaler
  float width = d > 0.0 ? 0.27 : 0.34;
  float band = 1.0 - smoothstep(0.0, width, abs(d));
  band = band * band * (3.0 - 2.0 * band);

  // Zum unteren Rand hin in Weiß auslaufen (ruhiger Grund für den Kundenstreifen)
  float uvy = gl_FragCoord.y / uResolution.y;
  band *= smoothstep(0.0, 0.26, uvy);

  // Farbfeld entlang des Bands: Phase h läuft entlang q.x und driftet langsam,
  // dadurch wechseln Violett, Cyan und Pink zyklisch statt nur einmal.
  float f1 = snoise(vec3(qw * 1.1 + 2.0, slow * 0.8));
  float f2 = snoise(vec3(qw * 0.7 - 5.0, slow * 0.6 + 9.0));
  float h = qw.x * 1.35 + f1 * 0.9 + t * TAU / 60.0;
  vec3 col = mix(uC1, uC2, smoothstep(-0.15, 0.85, sin(h)));
  col = mix(col, uC3, smoothstep(-0.25, 0.7, sin(h * 0.8 + 2.2 + f2 * 0.8)) * 0.92);
  // Kern des Bands leicht in Hellviolett, wirkt wie ein Glanz
  col = mix(col, uC4, (1.0 - smoothstep(0.0, 0.10, abs(d - 0.02))) * 0.22);

  vec3 outCol = mix(vec3(1.0), col, band);

  // Dither ±1/255 gegen Banding
  outCol += (hash12(gl_FragCoord.xy + fract(t) * 61.0) - 0.5) / 255.0;

  gl_FragColor = vec4(outCol, 1.0);
}
`;

const COLORS = ['#635BFF', '#00D4FF', '#FF6BB5', '#9089FC'];
const SLOW_FRAME_MS = 22;
const SAMPLE_FRAMES = 60;
// Auf sehr langsamen Geräten dauern 60 Frames mehrere Sekunden. Deshalb wird
// spätestens nach 1.5 s (mindestens 20 Frames) ausgewertet.
const SAMPLE_MAX_MS = 1500;
const SAMPLE_MIN_FRAMES = 20;
// Zeitkonstanten für weiches Nachführen, unabhängig von der Bildrate
const TAU_SPEED_MS = 250;     // Fokus-Pause: nach ca. 1.1 s Stillstand
const TAU_POINTER_MS = 470;
const WARMUP_FRAMES = 6;   // erste Frames enthalten Shader-Kompilierung
// Der Verlauf ist weich, volle Auflösung bringt keinen sichtbaren Gewinn.
// Obergrenze für gerenderte Pixel pro Frame (vor dem 0.6-Maßstab).
const MAX_PIXELS_DESKTOP = 1.6e6;
const MAX_PIXELS_MOBILE = 0.9e6;

const hexToVec3 = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
};

/**
 * Startet den Shader erst nach dem Laden der Seite in einer Leerlaufphase.
 * Bis dahin ist der CSS-Fallback sichtbar. So kostet das Kompilieren keine
 * Zeit vor dem ersten Inhalt (FCP/LCP) und blockiert nicht die Eingabe.
 */
export function initHeroGradient(root = document.querySelector('.hero__bg')) {
  if (!root) return null;
  const canvas = root.querySelector('canvas');
  root.dataset.state = 'css';
  const testMode = new URLSearchParams(location.search).get('hero'); // css | slow | gl | null
  if (testMode === 'css' || !canvas) return null;

  const run = () => setupGL(root, canvas, testMode).catch((err) => console.warn('[hero]', err));
  const whenIdle = () => ('requestIdleCallback' in window
    ? requestIdleCallback(run, { timeout: 1500 })
    : setTimeout(run, 300));
  if (document.readyState === 'complete') whenIdle();
  else addEventListener('load', whenIdle, { once: true });
  return true;
}

/** Software-Rasterizer (kein GPU-Zugriff) erkennen: dort ist der Shader immer zu teuer */
function isSoftwareRenderer(gl) {
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const name = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(String(name));
}

/** Wartet, bis der Treiber das Programm fertig gelinkt hat, ohne den Hauptthread zu blockieren */
function programReady(gl, prog) {
  const ext = gl.getExtension('KHR_parallel_shader_compile');
  if (!ext) return Promise.resolve();
  return new Promise((resolve) => {
    const poll = () => (gl.getProgramParameter(prog, ext.COMPLETION_STATUS_KHR) ? resolve() : requestAnimationFrame(poll));
    poll();
  });
}

async function setupGL(root, canvas, testMode) {
  const hero = root.closest('.hero') || root;
  const setState = (s) => { root.dataset.state = s; };
  const reducedMQ = matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = matchMedia('(pointer: coarse)').matches || innerWidth < 768;
  const maxDpr = coarse ? 1.0 : 1.5;
  const maxPixels = coarse ? MAX_PIXELS_MOBILE : MAX_PIXELS_DESKTOP;

  let gl;
  try {
    gl = canvas.getContext('webgl', {
      alpha: false, antialias: false, depth: false, stencil: false,
      premultipliedAlpha: false, preserveDrawingBuffer: false,
      powerPreference: 'low-power',
    });
  } catch { gl = null; }
  if (!gl) { root.dataset.reason = 'no-webgl'; return; }

  // ?hero=slow und ?hero=gl erzwingen WebGL auch auf Software-Renderern (für Tests)
  if (!['slow', 'gl'].includes(testMode) && isSoftwareRenderer(gl)) {
    root.dataset.reason = 'software';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return;
  }

  // --- Programm aufbauen (parallel, Status erst nach Fertigstellung abfragen) --
  const shader = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    return sh;
  };
  const vs = shader(gl.VERTEX_SHADER, VERT);
  const fs = shader(gl.FRAGMENT_SHADER, FRAG);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  await programReady(gl, prog);
  if (gl.isContextLost()) return;
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('[hero] Shader-Fehler:', gl.getShaderInfoLog(fs) || gl.getProgramInfoLog(prog));
    root.dataset.reason = 'compile';
    return;
  }
  gl.useProgram(prog);

  // Ein Dreieck, das den ganzen Clip-Space abdeckt (günstiger als zwei)
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const u = {};
  ['uResolution', 'uTime', 'uPointer', 'uScroll', 'uC1', 'uC2', 'uC3', 'uC4']
    .forEach((n) => { u[n] = gl.getUniformLocation(prog, n); });
  COLORS.forEach((hex, i) => gl.uniform3fv(u[`uC${i + 1}`], hexToVec3(hex)));

  // --- Zustand -------------------------------------------------------------
  let scale = 1;            // Render-Maßstab (sinkt bei langsamen Geräten auf 0.6)
  let raf = 0;
  let running = false;
  let inView = true;
  let destroyed = false;
  let shown = false;
  let time = 18;            // Startzeitpunkt mit schöner Komposition
  let lastTs = 0;
  let frames = 0;
  let sampleSum = 0;
  let sampleCount = 0;
  let downgraded = false;
  let speed = 1;            // Zeitfaktor: 1 = normal, läuft bei Fokus-Pause weich gegen 0
  let speedTarget = 1;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let scroll = 0;

  const resize = () => {
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    let dpr = Math.min(devicePixelRatio || 1, maxDpr);
    // Pixelbudget: bei großen Flächen Auflösung senken (Verlauf bleibt weich)
    const px = cw * ch * dpr * dpr;
    if (px > maxPixels) dpr *= Math.sqrt(maxPixels / px);
    dpr *= scale;
    const w = Math.max(1, Math.round(cw * dpr));
    const h = Math.max(1, Math.round(ch * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  };

  const draw = () => {
    resize();
    gl.uniform2f(u.uResolution, canvas.width, canvas.height);
    gl.uniform1f(u.uTime, time);
    gl.uniform2f(u.uPointer, pointer.x, pointer.y);
    gl.uniform1f(u.uScroll, scroll);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  // Canvas erst einblenden, wenn das erste Frame wirklich gezeichnet ist
  const reveal = () => {
    if (shown) return;
    shown = true;
    requestAnimationFrame(() => {
      root.classList.add('is-gl-ready');
      root.dispatchEvent(new CustomEvent('hero:ready', { bubbles: true }));
    });
  };

  const fallback = (reason) => {
    if (destroyed) return;   // loseContext() unten löst erneut webglcontextlost aus
    stop();
    destroyed = true;
    root.classList.remove('is-gl-ready');
    setState('css');
    root.dataset.reason = reason;
    // GPU-Speicher freigeben, sobald das Canvas ausgeblendet ist
    setTimeout(() => {
      canvas.width = 1;
      canvas.height = 1;
      if (reason !== 'context-lost') gl.getExtension('WEBGL_lose_context')?.loseContext();
    }, 1000);
  };

  // Frame-Zeit messen: Mittel > 22 ms -> Maßstab 0.6, danach noch zu langsam -> CSS
  const measure = (dt) => {
    frames++;
    if (frames <= WARMUP_FRAMES || dt > 250) return; // Tab-Wechsel o. Ä. ignorieren
    sampleSum += dt;
    sampleCount++;
    const enough = sampleCount >= SAMPLE_FRAMES
      || (sampleCount >= SAMPLE_MIN_FRAMES && sampleSum >= SAMPLE_MAX_MS);
    if (!enough) return;
    const avg = sampleSum / sampleCount;
    root.dataset.frameMs = avg.toFixed(1);
    sampleSum = 0;
    sampleCount = 0;
    if (avg <= SLOW_FRAME_MS) { frames = -Infinity; return; } // gut genug, Messung beenden
    if (!downgraded) {
      downgraded = true;
      scale = 0.6;
      root.dataset.scale = '0.6';
      frames = 0;
    } else {
      fallback('slow');
    }
  };

  const loop = (ts) => {
    if (!running) return;
    const dt = lastTs ? ts - lastTs : 16.7;
    lastTs = ts;
    if (testMode === 'slow') { const until = performance.now() + 30; while (performance.now() < until); }
    const step = Math.min(dt, 50);
    // Exponentielles Nachführen mit Zeitkonstante: gleiches Verhalten bei 30, 60 oder 120 Hz
    const ease = (tau) => 1 - Math.exp(-step / tau);
    // Zeitfaktor (Fokus-Pause), danach Zeit fortschreiben
    speed += (speedTarget - speed) * ease(TAU_SPEED_MS);
    time += (step / 1000) * speed;
    // Maus weich nachziehen
    const kp = ease(TAU_POINTER_MS);
    pointer.x += (pointer.tx - pointer.x) * kp;
    pointer.y += (pointer.ty - pointer.y) * kp;
    draw();
    reveal();
    // Fokus-Pause: nach dem Auslaufen keine Frames mehr rendern
    if (speedTarget === 0 && speed < 0.01) { speed = 0; stop(); return; }
    measure(dt);
    if (!destroyed) raf = requestAnimationFrame(loop);
  };

  function start() {
    if (running || destroyed || reducedMQ.matches) return;
    if (!inView || document.hidden || speedTarget === 0) return;
    running = true;
    lastTs = 0;
    raf = requestAnimationFrame(loop);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  const renderStatic = () => {
    stop();
    draw();
    reveal();
    setState('static');
  };

  const applyMotionPref = () => {
    if (destroyed) return;
    if (reducedMQ.matches) renderStatic();
    else { setState('webgl'); start(); }
  };

  // --- Ereignisse ----------------------------------------------------------
  const io = new IntersectionObserver(([e]) => {
    inView = e.isIntersecting;
    if (inView) start(); else stop();
  }, { threshold: 0 });
  io.observe(hero);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else start();
  });

  reducedMQ.addEventListener?.('change', applyMotionPref);

  // Pause bei Tastaturfokus im Hero (WCAG 2.2.2): Bewegung läuft weich aus
  // und setzt beim Verlassen weich wieder ein. Eine Hover-Pause gibt es
  // bewusst nicht, da der Shader dezent auf die Maus reagiert.
  hero.addEventListener('focusin', (e) => {
    if (!e.target.matches?.(':focus-visible')) return;
    speedTarget = 0;
    root.classList.add('is-paused');
  });
  hero.addEventListener('focusout', (e) => {
    if (hero.contains(e.relatedTarget)) return;
    speedTarget = 1;
    root.classList.remove('is-paused');
    if (!running && root.dataset.state === 'webgl') { speed = 0; start(); }
  });

  const ro = new ResizeObserver(() => { if (!running && !destroyed && shown) draw(); });
  ro.observe(canvas);

  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    addEventListener('pointermove', (e) => {
      pointer.tx = (e.clientX / innerWidth) * 2 - 1;
      pointer.ty = -((e.clientY / innerHeight) * 2 - 1);
    }, { passive: true });
  }

  const onScroll = () => {
    const h = hero.offsetHeight || 1;
    scroll = Math.min(Math.max(scrollY / h, 0), 1);
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    fallback('context-lost');
  });

  applyMotionPref();

  return {
    get state() { return root.dataset.state; },
    stop,
    start,
  };
}
