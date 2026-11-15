/**
 * Scroll- und Interaktionsanimationen (GSAP 3 + ScrollTrigger + Lenis).
 *
 * Grundregeln (Abschnitt 8 des Briefings):
 * - Nur transform, opacity und clip-path werden animiert.
 * - Timing: 0.6–1.0 s, power3.out (= cubic-bezier(.22,1,.36,1)), Stagger 0.06 s, Wege 24–40 px.
 * - Kein Scroll-Hijacking: Lenis glättet nur das Mausrad, Touch bleibt nativ.
 * - Reduced Motion: kein Lenis, kein Parallax, kein Scrub, Reveals nur als kurzes Einblenden.
 *
 * Klassen am <html>:
 *   motion      – volle Animationen aktiv (CSS dimmt dann z. B. inaktive Prozess-Schritte)
 *   anim-ready  – GSAP hat übernommen
 */
import { splitLines, unsplit } from './split-lines.js';

const EASE = 'power3.out';
const DUR = 0.9;
const STAGGER = 0.06;
const Y = 32;

const root = document.documentElement;
const navOffset = () => {
  const cs = getComputedStyle(root);
  return parseFloat(cs.getPropertyValue('--nav-h')) + parseFloat(cs.getPropertyValue('--nav-offset')) + 16;
};

export function initAnimations() {
  const { gsap, ScrollTrigger, Lenis } = window;
  if (!gsap || !ScrollTrigger) {
    // Bibliothek fehlt: alles sofort zeigen, Seite bleibt voll nutzbar
    root.classList.add('reveal-done');
    return null;
  }
  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: EASE, duration: DUR });
  // Hat das Sicherheitsnetz (3 s, Inline-Skript) die Inhalte schon gezeigt,
  // z. B. auf sehr langsamen Verbindungen, werden sie nicht wieder versteckt.
  revealsEnabled = !root.classList.contains('reveal-done');
  root.classList.add('anim-ready');

  const lenis = setupSmoothScroll(gsap, ScrollTrigger, Lenis);
  setupAnchors(lenis);

  // Drei getrennte Kontexte, damit z. B. ein Breitenwechsel über 900 px nur den
  // Stapel-Effekt neu aufbaut und nicht alle Reveals zurücksetzt.
  const mm = gsap.matchMedia();
  mm.add(
    { motion: '(prefers-reduced-motion: no-preference)', reduce: '(prefers-reduced-motion: reduce)' },
    (ctx) => {
      const { motion } = ctx.conditions;
      root.classList.toggle('motion', motion);
      reveals(gsap, ScrollTrigger, motion);
      headings(gsap, ScrollTrigger, motion);
      counters(gsap, ScrollTrigger, motion);
      if (motion) {
        processLine(gsap, ScrollTrigger);
        parallax(gsap);
      }
      return () => root.classList.remove('motion');
    },
  );
  mm.add('(prefers-reduced-motion: no-preference) and (min-width: 900px)', () => refsStack(gsap));
  mm.add('(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)', () => magnetic(gsap));

  refreshOnLoad(ScrollTrigger);
  return { lenis };
}

/* --------------------------------------------------------------------------
   Lenis: nur ohne Reduced Motion. An GSAPs Ticker gekoppelt, damit
   ScrollTrigger und Lenis im selben Frame rechnen.
   -------------------------------------------------------------------------- */
function setupSmoothScroll(gsap, ScrollTrigger, Lenis) {
  if (!Lenis || matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  const lenis = new Lenis({ duration: 1.1, smoothWheel: true, syncTouch: false, autoRaf: false });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  window.__lenis = lenis; // Menü stoppt/startet darüber das Scrollen
  // Wechselt die Einstellung zur Laufzeit auf "reduzieren": Lenis abschalten
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
    if (e.matches) { lenis.destroy(); window.__lenis = null; }
  });
  return lenis;
}

/* Ankerlinks auf derselben Seite: weich per Lenis, mit Abstand für die Navigation */
function setupAnchors(lenis) {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href*="#"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const url = new URL(a.href, location.href);
    if (url.pathname !== location.pathname || !url.hash) return;
    const target = url.hash === '#top' ? document.body : document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (!target) return;
    e.preventDefault();
    const offset = target === document.body ? 0 : -navOffset();
    const done = () => {
      // Fokus für Tastatur- und Screenreader-Nutzer an das Ziel übergeben
      if (target !== document.body) {
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
      history.pushState(null, '', url.hash);
    };
    if (lenis && window.__lenis) {
      lenis.scrollTo(target === document.body ? 0 : target, { offset, onComplete: done });
    } else {
      const top = target === document.body ? 0 : target.getBoundingClientRect().top + scrollY + offset;
      scrollTo({ top, behavior: 'auto' });
      done();
    }
  });
}

/* --------------------------------------------------------------------------
   Scroll-Reveals für [data-reveal] (gebündelt per ScrollTrigger.batch)
   -------------------------------------------------------------------------- */
let revealsEnabled = true;

function reveals(gsap, ScrollTrigger, motion) {
  const els = gsap.utils.toArray('[data-reveal]');
  if (!els.length || !revealsEnabled) return;
  gsap.set(els, motion ? { autoAlpha: 0, y: Y } : { autoAlpha: 0, y: 0 });
  ScrollTrigger.batch(els, {
    start: 'top 88%',
    once: true,
    onEnter: (batch) => gsap.to(batch, motion
      ? { autoAlpha: 1, y: 0, stagger: STAGGER, overwrite: true, clearProps: 'transform' }
      : { autoAlpha: 1, duration: 0.3, stagger: 0, overwrite: true }),
  });
}

/* --------------------------------------------------------------------------
   Überschriften: Zeilen gleiten aus ihrer Maske (nach document.fonts.ready,
   bei Resize entprellt neu). Reduced Motion: nur kurzes Einblenden.
   -------------------------------------------------------------------------- */
function headings(gsap, ScrollTrigger, motion) {
  const els = gsap.utils.toArray('[data-split]');
  if (!els.length || !revealsEnabled) return;
  if (!motion) {
    headingRebuild = null;
    els.forEach((el) => {
      gsap.set(el, { autoAlpha: 0 });
      ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true,
        onEnter: () => gsap.to(el, { autoAlpha: 1, duration: 0.3 }) });
    });
    return;
  }

  const state = headingState;
  // bis zur Zerlegung (wartet auf Schriften) unsichtbar halten
  els.forEach((el) => { if (!state.get(el)?.done) gsap.set(el, { autoAlpha: 0 }); });
  const build = (el) => {
    const prev = state.get(el);
    prev?.trigger?.kill();
    const lines = splitLines(el);
    gsap.set(lines, { yPercent: 110 });
    gsap.set(el, { autoAlpha: 1 });
    const trigger = ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      once: true,
      onEnter: () => {
        gsap.to(lines, {
          yPercent: 0,
          stagger: STAGGER * 1.5,
          duration: 1,
          onComplete: () => { state.get(el).done = true; },
        });
      },
    });
    state.set(el, { done: false, trigger });
  };

  const fontsReady = document.fonts?.ready ?? Promise.resolve();
  // nicht ewig auf Schriften warten
  Promise.race([fontsReady, new Promise((r) => setTimeout(r, 800))]).then(() => {
    els.forEach(build);
    ScrollTrigger.refresh();
  });

  // Bei Breitenänderung: bereits gezeigte Überschriften normal umbrechen lassen,
  // noch nicht gezeigte neu zerlegen (Zeilen passen sonst nicht mehr).
  // Der Listener wird nur einmal registriert, auch wenn der Kontext neu startet.
  headingRebuild = () => {
    els.forEach((el) => {
      const s = state.get(el);
      if (!s) return;
      if (s.done) { unsplit(el); el.classList.add('is-split'); }
      else build(el);
    });
    ScrollTrigger.refresh();
  };
  if (!headingResizeBound) {
    headingResizeBound = true;
    let lastW = innerWidth;
    let t = 0;
    addEventListener('resize', () => {
      if (Math.abs(innerWidth - lastW) < 2) return;
      clearTimeout(t);
      t = setTimeout(() => { lastW = innerWidth; headingRebuild?.(); }, 200);
    });
  }
}
const headingState = new Map(); // el -> { done, trigger }
let headingRebuild = null;
let headingResizeBound = false;

/* --------------------------------------------------------------------------
   Referenzen-Stapel: Rückt die nächste Karte heran, skaliert die vorherige
   auf 0.94 und dunkelt leicht ab (scrub). Nur Desktop (dort ist sticky aktiv).
   -------------------------------------------------------------------------- */
function refsStack(gsap) {
  const items = gsap.utils.toArray('.refs__item');
  // Sticky-Elemente melden ihre "festgeklebte" Position. Für die Trigger brauchen
  // wir die Position im normalen Fluss: kurz auf static schalten und messen.
  const flowTop = (el) => {
    const prev = el.style.position;
    el.style.position = 'static';
    const top = el.getBoundingClientRect().top + scrollY;
    el.style.position = prev;
    return top;
  };
  const stickyTop = () => parseFloat(getComputedStyle(items[0]).top) || 0;

  items.slice(0, -1).forEach((item, i) => {
    const next = items[i + 1];
    const card = item.querySelector('.ref-card');
    const shade = item.querySelector('.ref-card__shade');
    gsap.timeline({
      scrollTrigger: {
        trigger: next,
        start: () => flowTop(next) - innerHeight,
        end: () => flowTop(next) - stickyTop(),
        scrub: true,
        invalidateOnRefresh: true,
      },
    })
      .fromTo(card, { scale: 1 }, { scale: 0.94, ease: 'none' }, 0)
      .fromTo(shade, { opacity: 0 }, { opacity: 0.14, ease: 'none' }, 0);
  });
}

/* --------------------------------------------------------------------------
   Parallax: Bilder in Mockups bewegen sich langsamer als ihr Rahmen.
   Das Bild ist 112 % hoch (components.css), Weg max. 8 % der Bildhöhe.
   Es gleitet beim Hereinscrollen in seine Ruhelage (oben bündig) und steht,
   sobald der Rahmen im oberen Drittel ist. So bleibt bei gestapelten
   (sticky) Karten der Kopf der Kundenseite im Mockup sichtbar.
   -------------------------------------------------------------------------- */
function parallax(gsap) {
  gsap.utils.toArray('img[data-parallax]').forEach((img) => {
    const frame = img.closest('.browser__screen, .phone__screen') || img;
    gsap.fromTo(img, { yPercent: -6 }, {
      yPercent: 0,
      ease: 'none',
      scrollTrigger: { trigger: frame, start: 'top bottom', end: 'top 30%', scrub: true },
    });
  });
}

/* --------------------------------------------------------------------------
   Prozess: Linie zeichnet sich mit dem Scrollen, aktiver Schritt hervorgehoben
   -------------------------------------------------------------------------- */
function processLine(gsap, ScrollTrigger) {
  const steps = gsap.utils.toArray('[data-step]');
  const progress = document.querySelector('.process__progress');
  const wrap = document.querySelector('.process__steps');
  if (!steps.length || !progress || !wrap) return;

  gsap.fromTo(progress, { scaleY: 0 }, {
    scaleY: 1,
    ease: 'none',
    scrollTrigger: { trigger: wrap, start: 'top 62%', end: 'bottom 62%', scrub: true },
  });

  const setActive = (idx) => steps.forEach((s, i) => s.classList.toggle('is-active', i === idx));
  setActive(0);
  steps.forEach((step, i) => {
    ScrollTrigger.create({
      trigger: step,
      start: 'top 62%',
      onEnter: () => setActive(i),
      onLeaveBack: () => setActive(Math.max(0, i - 1)),
    });
  });
}

/* --------------------------------------------------------------------------
   Zahlen-Zähler (nur berechnete Kennzahlen, Startwert steht schon im HTML)
   -------------------------------------------------------------------------- */
function counters(gsap, ScrollTrigger, motion) {
  gsap.utils.toArray('[data-count]').forEach((el) => {
    const target = Number(el.dataset.count);
    if (!motion || !Number.isFinite(target)) { el.textContent = String(target); return; }
    const obj = { v: 0 };
    el.textContent = '0';
    ScrollTrigger.create({
      trigger: el,
      start: 'top 90%',
      once: true,
      onEnter: () => gsap.to(obj, {
        v: target,
        duration: 1.2,
        ease: 'power2.out',
        onUpdate: () => { el.textContent = String(Math.round(obj.v)); },
      }),
    });
  });
}

/* --------------------------------------------------------------------------
   Magnet-Buttons: ziehen sich bis zu 8 px zum Mauszeiger
   -------------------------------------------------------------------------- */
function magnetic(gsap) {
  const MAX = 8;
  gsap.utils.toArray('[data-magnetic]').forEach((btn) => {
    const xTo = gsap.quickTo(btn, 'x', { duration: 0.5, ease: 'power3.out' });
    const yTo = gsap.quickTo(btn, 'y', { duration: 0.5, ease: 'power3.out' });
    const move = (e) => {
      const r = btn.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      xTo(gsap.utils.clamp(-1, 1, dx) * MAX);
      yTo(gsap.utils.clamp(-1, 1, dy) * MAX * 0.6);
    };
    const leave = () => { xTo(0); yTo(0); };
    btn.addEventListener('pointermove', move);
    btn.addEventListener('pointerleave', leave);
  });
}

/* ScrollTrigger neu berechnen, wenn Schriften und große Bilder da sind */
function refreshOnLoad(ScrollTrigger) {
  let t = 0;
  const refresh = () => { clearTimeout(t); t = setTimeout(() => ScrollTrigger.refresh(), 120); };
  document.fonts?.ready.then(refresh);
  addEventListener('load', refresh);
  document.querySelectorAll('.refs img, .pj-hero img, .pj-gallery img').forEach((img) => {
    if (!img.complete) img.addEventListener('load', refresh, { once: true });
  });
}
