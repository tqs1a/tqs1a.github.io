/**
 * Custom-Cursor: kleiner Punkt (folgt direkt) und Ring (folgt mit Trägheit).
 * - Nur bei (hover: hover) and (pointer: fine) und ohne Reduced Motion.
 * - Über [data-cursor] (Referenzkarten) wird der Ring zur Pille mit Text.
 * - Über Links und Buttons wächst der Ring leicht.
 * - Auf Texteingaben ausgeblendet, dort gilt der System-Cursor.
 * - Tastaturbedienung bleibt unberührt; Touch-Geräte bekommen nichts davon.
 */
export function initCursor() {
  const { gsap } = window;
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  if (!gsap || !fine.matches || reduce.matches) return;

  const el = document.createElement('div');
  el.className = 'cursor is-hidden';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<div class="cursor__ring"><span class="cursor__label"></span></div><div class="cursor__dot"></div>';
  document.body.append(el);
  const ring = el.querySelector('.cursor__ring');
  const dot = el.querySelector('.cursor__dot');
  const label = el.querySelector('.cursor__label');

  // Punkt folgt praktisch direkt, Ring mit spürbarer Trägheit
  const dotX = gsap.quickTo(dot, 'x', { duration: 0.08, ease: 'power3.out' });
  const dotY = gsap.quickTo(dot, 'y', { duration: 0.08, ease: 'power3.out' });
  const ringX = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3.out' });
  const ringY = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3.out' });

  let active = false;
  const enable = () => {
    if (active) return;
    active = true;
    document.documentElement.classList.add('has-cursor');
  };
  const disable = () => {
    active = false;
    document.documentElement.classList.remove('has-cursor');
    el.classList.add('is-hidden');
  };

  const TEXT_INPUT = 'input:not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio]), textarea, select, [contenteditable]';

  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    enable();
    dotX(e.clientX); dotY(e.clientY);
    ringX(e.clientX); ringY(e.clientY);

    const t = e.target instanceof Element ? e.target : null;
    const onText = !!t?.closest(TEXT_INPUT);
    const view = t?.closest('[data-cursor]');
    const link = t?.closest('a, button, [role=button], summary, label');
    // Mockup-Link der Karte und "Nächstes Projekt" zählen als Kartenfläche
    const onLink = !!link && !link.matches('.ref-card__visual, [data-cursor]');
    el.classList.toggle('is-hidden', onText);
    // Pille nur über der Kartenfläche, nicht über den Buttons darin
    el.classList.toggle('is-view', !!view && !onLink);
    el.classList.toggle('is-link', onLink);
    el.classList.toggle('on-ink', !!t?.closest('.section--ink, .footer'));
    if (view && label.textContent !== view.dataset.cursor) label.textContent = view.dataset.cursor;
  }, { passive: true });

  document.addEventListener('pointerleave', () => el.classList.add('is-hidden'));
  addEventListener('blur', () => el.classList.add('is-hidden'));
  // Bei Touch- oder Stifteingabe sofort zurück zum System-Cursor
  addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') disable(); }, { passive: true });

  const onChange = () => { if (!fine.matches || reduce.matches) { disable(); el.remove(); } };
  fine.addEventListener('change', onChange);
  reduce.addEventListener('change', onChange);
}
