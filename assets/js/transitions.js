/**
 * Seitenübergänge.
 *
 * 1. Browser mit View Transitions für Seitenwechsel (window.CSSViewTransitionRule):
 *    Alles läuft über CSS (@view-transition in base.css). Das Mockup der Karte
 *    und das große Mockup der Projektseite teilen sich einen view-transition-name
 *    (.vt-<slug> in projects.css) und "wandern" dadurch ineinander.
 *
 * 2. Alle anderen Browser: 0.45 s Verlaufs-Wipe.
 *    - Interne Link-Klicks werden abgefangen, der Wipe deckt zu, dann wird navigiert.
 *    - Die neue Seite startet verdeckt: Das Inline-Skript im <head> setzt
 *      html.is-wiping schon vor dem ersten Paint, CSS deckt dann selbst auf
 *      (funktioniert also auch, falls dieses Modul nicht lädt).
 *    - Rückkehr aus dem bfcache (pageshow mit persisted): Wipe wieder aufdecken.
 *    Strg-/Cmd-Klick, neue Tabs, Downloads, mailto und externe Links bleiben unberührt.
 */
const KEY = 'nf-wipe';
const DURATION = 450;
const EASING = 'cubic-bezier(.22, 1, .36, 1)';

export function initTransitions() {
  if ('CSSViewTransitionRule' in window) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const wipe = document.createElement('div');
  wipe.className = 'wipe';
  wipe.setAttribute('aria-hidden', 'true');
  document.body.append(wipe);

  const play = (from, to, origin) => {
    wipe.getAnimations().forEach((a) => a.cancel());
    wipe.style.transformOrigin = origin;
    return wipe.animate(
      [{ transform: `scaleY(${from})` }, { transform: `scaleY(${to})` }],
      { duration: DURATION, easing: EASING, fill: 'forwards' },
    ).finished.catch(() => {});
  };

  addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    // Seite kommt aus dem bfcache und ist noch vom Wipe verdeckt
    try { sessionStorage.removeItem(KEY); } catch { /* egal */ }
    play(1, 0, '50% 0%');
  });

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target && a.target !== '_self') return;
    if (a.hasAttribute('download')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;                      // extern, mailto, tel
    if (url.pathname === location.pathname && url.search === location.search) return; // Anker/gleiche Seite
    e.preventDefault();
    try { sessionStorage.setItem(KEY, '1'); } catch { /* ohne Aufdecken auf der Zielseite */ }
    play(0, 1, '50% 100%').then(() => { location.href = url.href; });
  });
}
