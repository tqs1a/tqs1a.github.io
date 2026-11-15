/**
 * Kleiner Zeilen-Splitter für Überschriften (ersetzt SplitText).
 *
 * Zerlegt ein Element in Zeilen, so wie der Browser sie gerade umbricht:
 *   <span class="split-line" aria-hidden="true">
 *     <span class="split-line__inner">…Wörter dieser Zeile…</span>
 *   </span>
 * Der Originaltext bleibt per aria-label am Element erhalten.
 * Inline-Auszeichnungen (z. B. .text-gradient, .todo) bleiben pro Zeile
 * erhalten; aufeinanderfolgende Wörter mit derselben Klasse werden wieder
 * zusammengefasst, damit ein Verlauf nicht pro Wort neu beginnt.
 */

const originals = new WeakMap();

/** Text in Tokens zerlegen: [{ word, cls }] */
function tokenize(el) {
  const tokens = [];
  const walk = (node, cls) => {
    node.childNodes.forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) {
        n.textContent.split(/\s+/).filter(Boolean).forEach((word) => tokens.push({ word, cls }));
      } else if (n.nodeType === Node.ELEMENT_NODE) {
        walk(n, n.classList.length ? n.className : cls);
      }
    });
  };
  walk(el, '');
  return tokens;
}

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Zeilen-HTML aus Token-Gruppen bauen (gleiche Klassen zusammenfassen) */
function lineHtml(tokens) {
  let html = '';
  let i = 0;
  while (i < tokens.length) {
    const cls = tokens[i].cls;
    const words = [];
    while (i < tokens.length && tokens[i].cls === cls) words.push(escapeHtml(tokens[i++].word));
    const chunk = words.join(' ');
    html += (html ? ' ' : '') + (cls ? `<span class="${cls}">${chunk}</span>` : chunk);
  }
  return html;
}

/**
 * Element in Zeilen zerlegen. Gibt die inneren Zeilen-Elemente zurück.
 * Mehrfacher Aufruf ist erlaubt (stellt vorher den Originalzustand her).
 */
export function splitLines(el) {
  if (!originals.has(el)) originals.set(el, el.innerHTML);
  else el.innerHTML = originals.get(el);

  const label = el.textContent.replace(/\s+/g, ' ').trim();
  const tokens = tokenize(el);
  if (!tokens.length) return [];

  // 1. Jedes Wort einzeln messen
  el.innerHTML = tokens
    .map((t) => `<span class="split-word">${t.cls ? `<span class="${t.cls}">${escapeHtml(t.word)}</span>` : escapeHtml(t.word)}</span>`)
    .join(' ');
  const wordEls = [...el.querySelectorAll('.split-word')];

  // 2. Nach vertikaler Position zu Zeilen gruppieren
  const lines = [];
  let lastTop = null;
  wordEls.forEach((w, i) => {
    const top = Math.round(w.getBoundingClientRect().top);
    if (lastTop === null || Math.abs(top - lastTop) > 4) {
      lines.push([]);
      lastTop = top;
    }
    lines[lines.length - 1].push(tokens[i]);
  });

  // 3. Zeilen mit Maske aufbauen
  el.innerHTML = lines
    .map((l) => `<span class="split-line" aria-hidden="true"><span class="split-line__inner">${lineHtml(l)}</span></span>`)
    .join('');
  el.setAttribute('aria-label', label);
  el.classList.add('is-split');
  return [...el.querySelectorAll('.split-line__inner')];
}

/** Originalzustand wiederherstellen (z. B. nach der Animation bei Resize) */
export function unsplit(el) {
  if (!originals.has(el)) return;
  el.innerHTML = originals.get(el);
  el.removeAttribute('aria-label');
  el.classList.remove('is-split');
}
