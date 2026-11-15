/**
 * Einstiegspunkt. Jedes Modul tut eine Sache; main.js verdrahtet sie nur.
 * Inhalte stehen vollständig im HTML. JavaScript verbessert nur.
 */
import { site, copy } from '/data/site.js';
import { initHeroGradient } from './hero-gradient.js';
import { initTransitions } from './transitions.js';
// animations.js und cursor.js sowie GSAP/ScrollTrigger/Lenis werden erst in der
// ersten Leerlaufphase geladen (siehe unten), damit sie dem ersten Bildschirm
// keine Bandbreite und keine Rechenzeit wegnehmen.

/** Klassisches Skript nachladen (Reihenfolge wichtig: ScrollTrigger braucht gsap) */
const loadScript = (src) => new Promise((resolve, reject) => {
  const s = document.createElement('script');
  s.src = src;
  s.async = false;
  s.onload = resolve;
  s.onerror = () => reject(new Error(`${src} nicht geladen`));
  document.head.append(s);
});

const root = document.documentElement;

/* --------------------------------------------------------------------------
   Marquee: Logo-Satz so oft klonen, dass die Schleife nahtlos läuft.
   -------------------------------------------------------------------------- */
function initMarquee() {
  document.querySelectorAll('.marquee__track').forEach((track) => {
    const originals = [...track.children];
    if (!originals.length) return;
    const minWidth = Math.max(innerWidth, 1200);
    let guard = 0;
    while (track.scrollWidth < minWidth && guard++ < 12) {
      originals.forEach((li) => track.append(cloneHidden(li)));
    }
    // zweite, identische Hälfte für den -50%-Loop
    [...track.children].forEach((li) => track.append(cloneHidden(li)));
    const speed = 40; // px pro Sekunde, bewusst ruhig
    track.style.setProperty('--marquee-duration', `${(track.scrollWidth / 2) / speed}s`);
  });
}
function cloneHidden(node) {
  const c = node.cloneNode(true);
  c.setAttribute('aria-hidden', 'true');
  c.querySelectorAll('a').forEach((a) => a.setAttribute('tabindex', '-1'));
  return c;
}

/* --------------------------------------------------------------------------
   Navigation: beim Herunterscrollen ausblenden, beim Hochscrollen zeigen,
   aktiven Abschnitt hervorheben.
   -------------------------------------------------------------------------- */
function initNav() {
  const nav = document.querySelector('[data-nav]');
  if (!nav) return;
  let lastY = scrollY;
  let ticking = false;
  const update = () => {
    const y = scrollY;
    const delta = y - lastY;
    if (Math.abs(delta) > 6) {
      // nie ausblenden, solange der Fokus in der Navigation liegt
      const hide = delta > 0 && y > 160 && !nav.contains(document.activeElement);
      nav.classList.toggle('is-hidden', hide);
      lastY = y;
    }
    ticking = false;
  };
  addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(update); ticking = true; }
  }, { passive: true });
  nav.addEventListener('focusin', () => nav.classList.remove('is-hidden'));

  // aktiver Abschnitt (nur auf der Startseite vorhanden)
  const links = [...nav.querySelectorAll('.nav__link[href^="/#"]')];
  const sections = links.map((a) => document.getElementById(a.hash.slice(1))).filter(Boolean);
  if (!sections.length) return;
  const visible = new Map();
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => visible.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0));
    let best = null;
    let bestRatio = 0;
    visible.forEach((r, id) => { if (r > bestRatio) { best = id; bestRatio = r; } });
    links.forEach((a) => {
      if (a.hash.slice(1) === best) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  }, { rootMargin: '-35% 0px -55% 0px', threshold: [0, .01, .5, 1] });
  sections.forEach((s) => io.observe(s));
}

/* --------------------------------------------------------------------------
   Mobiles Vollbild-Menü: Focus-Trap, Esc, Fokus-Rückgabe, Scroll-Sperre.
   -------------------------------------------------------------------------- */
function initMenu() {
  const menu = document.querySelector('[data-menu]');
  const openBtn = document.querySelector('[data-menu-open]');
  if (!menu || !openBtn) return;
  const closeBtn = menu.querySelector('[data-menu-close]');
  const focusables = () => [...menu.querySelectorAll('a[href], button:not([disabled])')];
  let closeTimer = 0;

  const open = () => {
    clearTimeout(closeTimer);
    menu.hidden = false;
    openBtn.setAttribute('aria-expanded', 'true');
    root.style.overflow = 'hidden';
    window.__lenis?.stop();
    requestAnimationFrame(() => {
      menu.classList.add('is-open');
      closeBtn?.focus();
    });
  };
  const close = ({ returnFocus = true } = {}) => {
    if (menu.hidden) return;
    menu.classList.remove('is-open');
    openBtn.setAttribute('aria-expanded', 'false');
    root.style.overflow = '';
    window.__lenis?.start();
    closeTimer = setTimeout(() => { menu.hidden = true; }, 320);
    if (returnFocus) openBtn.focus();
  };

  openBtn.addEventListener('click', open);
  closeBtn?.addEventListener('click', () => close());
  // Links im Menü schließen es (Ziel übernimmt den Fokus)
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) close({ returnFocus: false }); });
  menu.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const f = focusables();
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  // Wechsel auf Desktop-Breite schließt das Menü
  matchMedia('(min-width: 900px)').addEventListener('change', (e) => { if (e.matches) close({ returnFocus: false }); });
}

/* --------------------------------------------------------------------------
   E-Mail kopieren + Toast (aria-live im HTML)
   -------------------------------------------------------------------------- */
function initCopyEmail() {
  const toast = document.querySelector('[data-toast]');
  const toastText = toast?.querySelector('[data-toast-text]');
  let timer = 0;
  const show = (msg) => {
    if (!toast) return;
    toastText.textContent = msg;
    toast.classList.add('is-visible');
    clearTimeout(timer);
    timer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
  };
  document.querySelectorAll('[data-copy-email]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const email = site.email;
      try {
        await navigator.clipboard.writeText(email);
      } catch {
        // Fallback: Adresse markieren, damit Strg+C funktioniert
        const el = document.querySelector('[data-email]');
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
      show(copy.kontakt.toast);
    });
  });
}

/* --------------------------------------------------------------------------
   Kleinigkeiten
   -------------------------------------------------------------------------- */
function initYear() {
  document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });
}

/** Lichtschein auf Karten folgt dem Mauszeiger (CSS-Variablen --mx/--my) */
function initGlow() {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  document.querySelectorAll('[data-glow]').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    }, { passive: true });
  });
}

/**
 * Ganze Referenzkarte klickbar (Maus), ohne verschachtelte Links im HTML.
 * Tastatur und Screenreader nutzen die echten Buttons in der Karte.
 */
function initCardLinks() {
  document.querySelectorAll('[data-ref]').forEach((card) => {
    const link = card.querySelector('.ref-card__ctas a[href^="/projekte/"]');
    if (!link) return;
    card.addEventListener('click', (e) => {
      if (e.target.closest('a, button')) return;
      if (getSelection()?.toString()) return; // Text wurde markiert
      if (e.metaKey || e.ctrlKey) { open(link.href, '_blank', 'noopener'); return; }
      link.click(); // läuft so auch durch den Seitenübergang
    });
  });
}

/* --------------------------------------------------------------------------
   Start – jedes Modul einzeln abgesichert, damit ein Fehler nicht alles stoppt
   -------------------------------------------------------------------------- */
const safe = (name, fn) => {
  try { fn(); } catch (err) { console.error(`[${name}]`, err); }
};
// Nach dem ersten Paint bzw. in der ersten Leerlaufphase: hält den Hauptthread
// frei, solange der erste Bildschirm gezeichnet wird (LCP). Die Inhalte im
// ersten Bildschirm animieren per CSS und brauchen GSAP nicht.
const afterPaint = (fn) => requestAnimationFrame(() => setTimeout(fn, 0));
const whenIdle = (fn) => ('requestIdleCallback' in window
  ? requestIdleCallback(fn, { timeout: 500 })
  : setTimeout(fn, 120));

safe('hero', () => initHeroGradient());
safe('nav', initNav);
safe('menu', initMenu);
safe('copy', initCopyEmail);
safe('year', initYear);
safe('cards', initCardLinks);
safe('transitions', initTransitions);
afterPaint(() => safe('marquee', initMarquee));
whenIdle(async () => {
  safe('glow', initGlow);
  try {
    const [{ initAnimations }, { initCursor }] = await Promise.all([
      import('./animations.js'),
      import('./cursor.js'),
      loadScript('/assets/vendor/gsap.min.js')
        .then(() => Promise.all([loadScript('/assets/vendor/ScrollTrigger.min.js'), loadScript('/assets/vendor/lenis.min.js')])),
    ]);
    safe('animations', () => { if (!initAnimations()) root.classList.add('reveal-done'); });
    safe('cursor', initCursor);
  } catch (err) {
    // Netzwerkfehler o. Ä.: Seite bleibt ohne Animationen voll nutzbar
    console.warn('[animations]', err);
    root.classList.add('reveal-done');
  }
});
