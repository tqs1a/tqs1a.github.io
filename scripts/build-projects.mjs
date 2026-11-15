#!/usr/bin/env node
/**
 * Build-Hilfsskript (Node ≥ 18, keine Pakete).
 *
 *   node scripts/build-projects.mjs
 *
 * 1. Schreibt alle Texte aus data/site.js in index.html und 404.html
 *    (Elemente mit data-copy / data-copy-attr), damit sie ohne JS dastehen.
 * 2. Erzeugt aus data/projects.json: Kundenstreifen, Referenzkarten,
 *    Kennzahlen und Footer-Links in index.html, assets/css/projects.css,
 *    projekte/<slug>.html und sitemap.xml.
 *
 * Generierte Bereiche stehen zwischen <!-- NAME:START --> und <!-- NAME:END -->.
 * Navigation, Kontakt und Footer der Projektseiten werden aus index.html
 * übernommen (Marker SHARED:…), damit es nur eine Quelle gibt.
 */
import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const r = (...p) => path.join(ROOT, ...p);

const { site, copy, fill } = await import(pathToFileURL(r('data/site.js')).href + `?t=${Date.now()}`);
const { projekte } = JSON.parse(await readFile(r('data/projects.json'), 'utf8'));
const YEAR = new Date().getFullYear();

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const isTodo = (s) => /\[\[TODO/.test(String(s ?? ''));
/** Text escapen und [[TODO: …]] sichtbar markieren */
const txt = (s) => esc(fill(s)).replace(/\[\[TODO:[^\]]*\]\]/g, (m) => `<span class="todo">${m}</span>`);
/** Klartext für Attribute, <title> und Meta-Angaben */
const plain = (s) => esc(fill(s));

const get = (key) => {
  if (key.includes('{')) return key; // direkte Vorlage, z. B. "{name} – zur Startseite"
  const [head, ...rest] = key.split('.');
  let v = head === 'site' ? site : copy[head];
  for (const k of rest) v = v?.[k];
  if (v === undefined) throw new Error(`Unbekannter Text-Schlüssel: ${key}`);
  return v;
};

const pad = (n) => String(n).padStart(2, '0');
const mailHref = () => {
  const subject = `?subject=${encodeURIComponent(copy.kontakt.mailSubject)}`;
  return isTodo(site.email) ? `mailto:${subject}` : `mailto:${site.email}${subject}`;
};

/** Ersetzt den Inhalt von Elementen mit data-copy, zählt verschachtelte gleiche Tags mit */
function fillCopy(html) {
  const open = /<([a-z][a-z0-9]*)\b([^>]*?)\sdata-copy="([^"]+)"([^>]*)>/gi;
  let out = '';
  let last = 0;
  let m;
  while ((m = open.exec(html))) {
    const [tagOpen, tag, , key] = m;
    const start = m.index + tagOpen.length;
    // passendes schließendes Tag finden
    const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
    re.lastIndex = start;
    let depth = 1;
    let t;
    while ((t = re.exec(html))) {
      depth += t[1] ? -1 : 1;
      if (depth === 0) break;
    }
    if (!t) throw new Error(`Kein schließendes </${tag}> für data-copy="${key}"`);
    const value = get(key);
    const inner = tag.toLowerCase() === 'title' ? plain(value) : txt(value);
    out += html.slice(last, start) + inner;
    last = t.index;
    open.lastIndex = t.index;
  }
  out += html.slice(last);

  // Attribute: data-copy-attr="content:seo.description;aria-label:{name} …"
  out = out.replace(/<[a-z][^>]*\sdata-copy-attr="([^"]+)"[^>]*>/gi, (tagStr, spec) => {
    let res = tagStr;
    for (const part of spec.split(';')) {
      const i = part.indexOf(':');
      const attr = part.slice(0, i).trim();
      const val = plain(get(part.slice(i + 1).trim()));
      const attrRe = new RegExp(`(\\s${attr}=")[^"]*(")`);
      res = attrRe.test(res) ? res.replace(attrRe, `$1${val}$2`) : res.replace(/\s*\/?>$/, ` ${attr}="${val}">`);
    }
    return res;
  });

  // mailto-Links, Jahr, Monogramm
  out = out.replace(/(<a\b[^>]*\s)href="[^"]*"([^>]*\sdata-mailto\b)/g, `$1href="${mailHref()}"$2`);
  out = out.replace(/(<span\b[^>]*data-year[^>]*>)[^<]*(<\/span>)/g, `$1${YEAR}$2`);
  out = out.replace(/(<span\b[^>]*data-monogram[^>]*>)[^<]*(<\/span>)/g, `$1${esc(site.name.trim().charAt(0).toUpperCase())}$2`);
  return out;
}

/** Bereich zwischen <!-- NAME:START … --> und <!-- NAME:END --> ersetzen */
function inject(html, name, content) {
  const re = new RegExp(`(<!-- ${name}:START[^>]*-->)[\\s\\S]*?(\\s*<!-- ${name}:END -->)`);
  if (!re.test(html)) throw new Error(`Marker ${name} fehlt`);
  return html.replace(re, (_, a, b) => `${a}\n${content}${b}`);
}
function extract(html, name) {
  const m = html.match(new RegExp(`<!-- SHARED:${name}:START -->[\\s\\S]*?<!-- SHARED:${name}:END -->`));
  if (!m) throw new Error(`SHARED:${name} fehlt in index.html`);
  return m[0];
}
const indent = (s, n) => s.split('\n').map((l) => (l ? ' '.repeat(n) + l : l)).join('\n');

// ---------------------------------------------------------------------------
// Bausteine
// ---------------------------------------------------------------------------
const ICON_ARROW = '<svg class="icon icon--arrow" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M11 5l5 5-5 5"/></svg>';
const ICON_EXT = '<svg class="icon icon--ext" viewBox="0 0 20 20" aria-hidden="true"><path d="M8 4H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3M11 4h5v5M16 4l-7 7"/></svg>';
const ICON_BACK = '<svg class="icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M16 10H5M9 5l-5 5 5 5"/></svg>';

function logoImg(p, { alt = true, cls = '', lazy = true } = {}) {
  const l = p.logo;
  const a = alt && !l.wortmarke ? plain(p.name) : '';
  return `<picture><source type="image/webp" srcset="${l.src}"><img${cls ? ` class="${cls}"` : ''} src="${l.fallback}" alt="${a}" width="${l.width}" height="${l.height}"${lazy ? ' loading="lazy"' : ''} decoding="async"></picture>`
    + (l.wortmarke ? `<span>${txt(p.kurzname)}</span>` : '');
}

/** Screenshot als <picture> mit WebP-srcset und JPG-Fallback */
function shot(view, { sizes, alt = '', eager = false, priority = false, low = false, parallax = true }) {
  const srcset = view.breiten.map((w) => `${view.base}-${w}.webp ${w}w`).join(', ');
  const fallbackW = view.breiten.includes(1440) ? 1440 : view.breiten.at(-1);
  return `<picture><source type="image/webp" srcset="${srcset}" sizes="${sizes}"><img src="${view.base}-${fallbackW}.jpg" alt="${plain(alt)}" width="${view.width}" height="${view.height}" ${priority ? 'fetchpriority="high" ' : ''}${low ? 'fetchpriority="low" ' : ''}${eager ? '' : 'loading="lazy" '}decoding="async"${parallax ? ' data-parallax' : ''}></picture>`;
}

function stage(p, { eager = false, detail = false } = {}) {
  const pr = p.praesentation;
  const host = p.url ? new URL(p.url).host : 'Vorschau';
  const deskSizes = detail ? '(min-width: 1130px) 960px, calc(92vw - 37px)' : '(min-width: 900px) 620px, 90vw';
  const mobSizes = detail ? '(min-width: 1200px) 220px, 22vw' : '(min-width: 900px) 150px, 24vw';
  return `<div class="stage vt-${p.slug}">
  <div class="browser">
    <div class="browser__bar" aria-hidden="true"><i></i><i></i><i></i><span class="browser__url">${esc(host)}</span></div>
    <div class="browser__screen">${shot(pr.desktop, { sizes: deskSizes, alt: detail ? pr.desktop.alt : '', eager, priority: eager })}</div>
  </div>
  <div class="phone"><div class="phone__screen">${shot(pr.mobil, { sizes: mobSizes, alt: detail ? pr.mobil.alt : '', eager })}</div></div>
</div>`;
}

const liveLink = (p, cls = 'link-arrow') => p.url
  ? `<a class="${cls}" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">${txt(copy.referenzen.ctaLive)}<span class="sr-only"> (${plain(p.kurzname)}, öffnet in neuem Tab)</span> ${ICON_EXT}</a>`
  : '';

// --- Hauptseite ------------------------------------------------------------
function clientsHtml() {
  const items = projekte.map((p) =>
    `    <li><a class="client-logo" href="/projekte/${p.slug}.html">${logoImg(p, { lazy: false })}</a></li>`).join('\n');
  return `        <div class="marquee" role="region" aria-labelledby="clients-label" data-marquee>
          <ul class="marquee__track" role="list">
${indent(items, 8)}
          </ul>
        </div>`;
}

function refsHtml() {
  const total = pad(projekte.length);
  const cards = projekte.map((p, i) => `<li class="refs__item">
  <article class="ref-card p-${p.slug}" aria-labelledby="ref-${p.slug}" data-ref data-cursor="Ansehen">
    <div class="ref-card__inner">
      <div class="ref-card__text">
        <div class="ref-card__meta">
          <span class="ref-card__logo">${logoImg(p, { alt: true })}</span>
          <span class="ref-card__count"><span class="sr-only">Projekt </span>${pad(i + 1)} / ${total}</span>
        </div>
        <h3 class="ref-card__title" id="ref-${p.slug}">${txt(p.name)}</h3>
        <p class="ref-card__branche">${txt(p.branche)} · ${txt(p.ort)} · ${txt(p.jahr)}</p>
        <p class="ref-card__kurz">${txt(p.kurz)}</p>
        <ul class="tags" role="list" aria-label="Schwerpunkte">
          ${p.tags.map((t) => `<li class="tag">${txt(t)}</li>`).join('\n          ')}
        </ul>
        <div class="ref-card__ctas">
          <a class="btn btn--primary" href="/projekte/${p.slug}.html">${txt(copy.referenzen.ctaProjekt)}<span class="sr-only">: ${plain(p.kurzname)}</span> ${ICON_ARROW}</a>
          ${liveLink(p)}
        </div>
      </div>
      <a class="ref-card__visual" href="/projekte/${p.slug}.html" tabindex="-1" aria-hidden="true">
${indent(stage(p), 8)}
      </a>
    </div>
    <div class="ref-card__shade" aria-hidden="true"></div>
  </article>
</li>`).join('\n');
  return `        <ol class="refs__list" role="list">
${indent(cards, 10)}
        </ol>`;
}

function statsHtml() {
  // Nur berechnete Werte aus projects.json – keine erfundenen Zahlen
  const branchen = new Set(projekte.map((p) => p.branche.split('·')[0].trim())).size;
  const stats = [
    [projekte.length, copy.ueber.statReferenzen],
    [branchen, copy.ueber.statBranchen],
  ];
  return `          <dl class="stats" data-reveal>
${stats.map(([v, l]) => `            <div class="stat"><dt class="stat__label">${txt(l)}</dt><dd class="stat__value" data-count="${v}">${v}</dd></div>`).join('\n')}
          </dl>`;
}

function legalHtml() {
  if (!site.legalLinks?.length) return '';
  return `        <ul class="footer__legal" role="list">
${site.legalLinks.map((l) => `          <li><a href="${esc(l.href)}">${txt(l.label)}</a></li>`).join('\n')}
        </ul>`;
}

function projectsCss() {
  const lines = projekte.map((p) =>
    `.p-${p.slug} { --p-accent: ${p.accent}; --p-accent-2: ${p.accent2}; }\n`
    + `.vt-${p.slug} { view-transition-name: project-${p.slug}; }`);
  return `/* GENERIERT von scripts/build-projects.mjs aus data/projects.json – nicht von Hand ändern. */\n${lines.join('\n')}\n`;
}

// --- Gemeinsamer <head>-Teil: CSP, Inline-Skript, Icons, Vorschau, JSON-LD ---
/**
 * Einziges Inline-Skript der Seite. Es läuft vor dem ersten Paint:
 * - html.js aktiviert die Ausgangszustände der Animationen
 * - html.is-wiping: Zielseite eines Seitenwechsels startet verdeckt (Fallback ohne View Transitions)
 * - Sicherheitsnetz: nach 3 s alle Reveal-Inhalte zeigen, falls Skripte nicht laden
 * Der CSP-Hash wird unten automatisch daraus berechnet.
 */
const INLINE_SCRIPT = "(function(d){d.classList.add('js');try{if(sessionStorage.getItem('nf-wipe')){sessionStorage.removeItem('nf-wipe');d.classList.add('is-wiping')}}catch(e){}setTimeout(function(){d.classList.add('reveal-done')},3000)})(document.documentElement)";
const INLINE_HASH = `sha256-${createHash('sha256').update(INLINE_SCRIPT).digest('base64')}`;
// Hosts für Live-Vorschauen (Präsentationstyp "live"); bisher keine
const FRAME_HOSTS = projekte.filter((p) => p.praesentation.typ === 'live' && p.url).map((p) => new URL(p.url).origin);
// --- Kritisches CSS -----------------------------------------------------------
// Für den ersten Bildschirm inline im <head> (kein render-blockierender Request),
// sections.css lädt im <body> nach dem ersten Bildschirm. Quelle bleiben die
// Dateien in assets/css – nach CSS-Änderungen dieses Skript erneut ausführen.
const cssFile = (n) => readFile(r('assets/css', n), 'utf8');
const minifyCss = (c) => c.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{};])\s*/g, '$1').trim();
const [cTokens, cBase, cComponents, cSections, cProject] = await Promise.all(
  ['tokens.css', 'base.css', 'components.css', 'sections.css', 'project.css'].map(cssFile));
const heroCss = (cSections.match(/\/\* CRITICAL:START[^*]*\*\/([\s\S]*?)\/\* CRITICAL:END \*\//) || [])[1];
if (!heroCss) throw new Error('Marker CRITICAL:START/END fehlen in sections.css');
const CRITICAL = {
  index: minifyCss(cTokens + cBase + cComponents + heroCss + projectsCss()),
  project: minifyCss(cTokens + cBase + cComponents + cProject + projectsCss()),
};
const styleHash = (c) => `'sha256-${createHash('sha256').update(c).digest('base64')}'`;
const LATE_CSS = '<link rel="stylesheet" href="/assets/css/sections.css">';

const CSP = [
  "default-src 'self'",
  `script-src 'self' '${INLINE_HASH}'`,
  `style-src 'self' ${Object.values(CRITICAL).map(styleHash).join(' ')}`,
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'self'",
  `frame-src ${FRAME_HOSTS.length ? FRAME_HOSTS.join(' ') : "'none'"}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  'upgrade-insecure-requests',
].join('; ');

function headMeta({ url, title, desc, image, imgW, imgH, type = 'website', ld, noindex = false, css, preload = '' }) {
  const lds = (Array.isArray(ld) ? ld : ld ? [ld] : [])
    .map((o) => `  <script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('\n');
  return `  <meta http-equiv="Content-Security-Policy" content="${CSP}">
  <script>${INLINE_SCRIPT}</script>${noindex ? '\n  <meta name="robots" content="noindex">' : ''}
  <style>${css}</style>${preload}
  <link rel="preload" href="/assets/fonts/inter-latin-variable.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">
  <meta property="og:type" content="${type}">
  <meta property="og:locale" content="de_DE">
  <meta property="og:site_name" content="${plain(site.name)}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${desc}">${url ? `\n  <meta property="og:url" content="${url}">` : ''}
  <meta property="og:image" content="${image}">
  <meta property="og:image:width" content="${imgW}">
  <meta property="og:image:height" content="${imgH}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${desc}">
  <meta name="twitter:image" content="${image}">${lds ? `\n${lds}` : ''}`;
}

function indexHead() {
  const title = plain(copy.seo.title);
  const desc = plain(copy.seo.description);
  const hasEmail = !isTodo(site.email);
  const ld = [
    { '@context': 'https://schema.org', '@type': 'WebSite', name: site.name, url: `${site.url}/`, inLanguage: 'de' },
    {
      '@context': 'https://schema.org',
      '@type': 'ProfessionalService',
      name: site.name,
      url: `${site.url}/`,
      description: fill(copy.seo.description),
      image: `${site.url}/assets/img/og-image.jpg`,
      ...(hasEmail ? { email: site.email } : {}),
      knowsAbout: ['Webdesign', 'Webentwicklung'],
    },
  ];
  return headMeta({ url: `${site.url}/`, title, desc, image: `${site.url}/assets/img/og-image.jpg`, imgW: 1200, imgH: 630, ld, css: CRITICAL.index });
}

// --- 404 ---------------------------------------------------------------------
function notFoundPage(shared) {
  const title = plain(`${copy.notFound.title} – ${site.name}`);
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${title}</title>
  <meta name="description" content="${plain(copy.notFound.title)}">
  <meta name="theme-color" content="${site.themeColor}">
  <meta name="referrer" content="strict-origin-when-cross-origin">
${headMeta({ title, desc: plain(copy.seo.description), image: `${site.url}/assets/img/og-image.jpg`, imgW: 1200, imgH: 630, noindex: true, css: CRITICAL.project })}
  <script type="module" src="/assets/js/main.js"></script>
</head>
<body id="top" class="page-404">
  <a class="skip-link" href="#inhalt">${txt(copy.skipLink)}</a>

  ${shared.DEFS}

  ${shared.NAV}

  <main id="inhalt" tabindex="-1">
    <section class="nf" aria-labelledby="nf-title">
      <div class="nf__bg" aria-hidden="true"></div>
      <div class="container nf__inner">
        <p class="eyebrow">404</p>
        <h1 class="nf__title" id="nf-title">${txt(copy.notFound.title)}</h1>
        <a class="btn btn--primary" href="/">${txt(copy.notFound.cta)} ${ICON_ARROW}</a>
      </div>
    </section>
  </main>
  ${LATE_CSS}

  ${shared.FOOTER}
</body>
</html>
`;
}

// --- Projektseite ----------------------------------------------------------
function projectPage(p, i, shared) {
  const next = projekte[(i + 1) % projekte.length];
  const url = `${site.url}/projekte/${p.slug}.html`;
  const title = plain(fill(copy.projekt.seoTitle).replace('{projekt}', p.kurzname));
  const desc = plain(p.kurz);
  const ogImg = `${site.url}${p.praesentation.desktop.base}-1440.jpg`;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: `Website ${p.name}`,
    description: fill(p.kurz),
    url,
    image: ogImg,
    ...(isTodo(p.jahr) ? {} : { dateCreated: p.jahr }),
    creator: { '@type': 'Organization', name: site.name, url: `${site.url}/` },
    about: { '@type': 'Organization', name: p.name, ...(p.url ? { url: p.url } : {}) },
    keywords: p.tags.join(', '),
  };
  const meta = [
    [copy.projekt.jahr, txt(p.jahr)],
    [copy.projekt.leistungen, p.leistungen.map(txt).join(', ')],
    [copy.projekt.technik, p.technik.map(txt).join(', ')],
    [copy.projekt.umfang, txt(p.umfang)],
  ];
  const chapters = [
    ['aufgabe', copy.projekt.aufgabe, p.aufgabe],
    ['loesung', copy.projekt.loesung, p.loesung],
    ['ergebnis', copy.projekt.ergebnis, p.ergebnis],
  ];
  const pr = p.praesentation;

  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${title}</title>
  <meta name="description" content="${desc}">
  <meta name="theme-color" content="${site.themeColor}">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <link rel="canonical" href="${url}">
${headMeta({ url, title, desc, image: ogImg, imgW: 1440, imgH: 900, type: 'article', ld, css: CRITICAL.project,
    preload: `\n  <link rel="preload" as="image" type="image/webp" fetchpriority="high" imagesrcset="${pr.desktop.breiten.map((w) => `${pr.desktop.base}-${w}.webp ${w}w`).join(', ')}" imagesizes="(min-width: 1130px) 960px, calc(92vw - 37px)">` })}
  <script type="module" src="/assets/js/main.js"></script>
</head>
<body id="top" class="page-project p-${p.slug}">
  <a class="skip-link" href="#inhalt">${txt(copy.skipLink)}</a>

  ${shared.DEFS}

  ${shared.NAV}

  <main id="inhalt" tabindex="-1">
    <section class="pj-hero" aria-labelledby="pj-title">
      <div class="pj-hero__bg" aria-hidden="true"></div>
      <div class="container">
        <a class="pj-back link-arrow" href="/#referenzen">${ICON_BACK} ${txt(copy.nav.zurueck)}</a>
        <div class="pj-hero__head">
          <span class="ref-card__logo">${logoImg(p, { lazy: false })}</span>
          <h1 class="pj-hero__title" id="pj-title">${txt(p.name)}</h1>
          <p class="pj-hero__branche">${txt(p.branche)} · ${txt(p.ort)}</p>
          <ul class="tags" role="list" aria-label="Schwerpunkte">
            ${p.tags.map((t) => `<li class="tag">${txt(t)}</li>`).join('\n            ')}
          </ul>
        </div>
        <div class="pj-hero__visual">
${indent(stage(p, { eager: true, detail: true }), 10)}
        </div>
      </div>
    </section>

    ${LATE_CSS}

    <section class="pj-meta" aria-label="Projektdaten">
      <div class="container">
        <div class="pj-meta__bar card" data-reveal>
          <dl class="pj-meta__list">
${meta.map(([k, v]) => `            <div><dt>${txt(k)}</dt><dd>${v}</dd></div>`).join('\n')}
          </dl>
          ${p.url ? liveLink(p, 'btn btn--secondary') : `<p class="pj-meta__note">${txt(p.urlHinweis || copy.projekt.liveFehlt)}</p>`}
        </div>
      </div>
    </section>

    <section class="section pj-chapters" aria-label="${plain(copy.projekt.aufgabe)}, ${plain(copy.projekt.loesung)}, ${plain(copy.projekt.ergebnis)}">
      <div class="container">
${chapters.map(([id, h, t]) => `        <article class="pj-chapter" id="${id}">
          <h2 class="pj-chapter__title" data-split>${txt(h)}</h2>
          <p class="pj-chapter__text" data-reveal>${txt(t)}</p>
        </article>`).join('\n')}
      </div>
    </section>

    <section class="section section--soft pj-gallery" aria-labelledby="gallery-title">
      <div class="container">
        <h2 class="sr-only" id="gallery-title">${txt(copy.projekt.galerie)}</h2>
        <div class="pj-gallery__grid">
          <figure class="pj-gallery__desk" data-reveal>
            <div class="browser">
              <div class="browser__bar" aria-hidden="true"><i></i><i></i><i></i><span class="browser__url">${esc(p.url ? new URL(p.url).host : 'Vorschau')}</span></div>
              <div class="browser__screen">${shot(pr.desktop, { sizes: '(min-width: 1024px) 760px, 90vw', alt: pr.desktop.alt, low: true })}</div>
            </div>
          </figure>
          <figure class="pj-gallery__mob" data-reveal>
            <div class="phone"><div class="phone__screen">${shot(pr.mobil, { sizes: '(min-width: 1024px) 300px, 60vw', alt: pr.mobil.alt, low: true })}</div></div>
          </figure>
        </div>
      </div>
    </section>

    <section class="section pj-highlights" aria-labelledby="hl-title">
      <div class="container">
        <header class="section-head">
          <p class="eyebrow" data-reveal>${txt(copy.projekt.highlights)}</p>
          <h2 id="hl-title" class="sr-only">${txt(copy.projekt.highlights)}</h2>
        </header>
        <ul class="pj-highlights__grid" role="list">
${p.highlights.map((h, k) => `          <li class="card pj-hl${k === 0 || k === 3 ? ' pj-hl--wide' : ''}" data-reveal data-glow>
            <span class="pj-hl__nr" aria-hidden="true">${pad(k + 1)}</span>
            <h3>${txt(h.titel)}</h3>
            <p>${txt(h.text)}</p>
          </li>`).join('\n')}
        </ul>
      </div>
    </section>

    <section class="pj-next p-${next.slug}" aria-label="${plain(copy.projekt.naechstes)}">
      <a class="pj-next__link" href="/projekte/${next.slug}.html" data-cursor="Ansehen">
        <span class="container pj-next__inner">
          <span class="eyebrow">${txt(copy.projekt.naechstes)}</span>
          <span class="pj-next__name">${txt(next.name)}</span>
          <span class="pj-next__arrow" aria-hidden="true">${ICON_ARROW}</span>
        </span>
      </a>
    </section>

    ${shared.CONTACT}
  </main>

  ${shared.FOOTER}
</body>
</html>
`;
}

// --- Sitemap -----------------------------------------------------------------
function sitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [`${site.url}/`, ...projekte.map((p) => `${site.url}/projekte/${p.slug}.html`)];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`;
}

// ---------------------------------------------------------------------------
// Ausführen
// ---------------------------------------------------------------------------
const slugs = new Set();
for (const p of projekte) {
  if (!/^[a-z0-9-]+$/.test(p.slug)) throw new Error(`Ungültiger slug: ${p.slug}`);
  if (slugs.has(p.slug)) throw new Error(`Doppelter slug: ${p.slug}`);
  slugs.add(p.slug);
}

let index = await readFile(r('index.html'), 'utf8');
index = inject(index, 'HEAD', indexHead());
index = inject(index, 'CLIENTS', clientsHtml());
index = inject(index, 'REFS', refsHtml());
index = inject(index, 'STATS', statsHtml());
index = inject(index, 'LEGAL', legalHtml());
index = fillCopy(index);
await writeFile(r('index.html'), index);

const shared = Object.fromEntries(['DEFS', 'NAV', 'CONTACT', 'FOOTER'].map((n) => [n, extract(index, n)]));

await writeFile(r('assets/css/projects.css'), projectsCss());

await mkdir(r('projekte'), { recursive: true });
// verwaiste Projektseiten entfernen (Projekt aus der JSON gelöscht)
for (const f of await readdir(r('projekte'))) {
  if (f.endsWith('.html') && !slugs.has(f.replace(/\.html$/, ''))) await unlink(r('projekte', f));
}
for (const [i, p] of projekte.entries()) {
  await writeFile(r('projekte', `${p.slug}.html`), fillCopy(projectPage(p, i, shared)));
}

await writeFile(r('404.html'), fillCopy(notFoundPage(shared)));
await writeFile(r('sitemap.xml'), sitemap());
await writeFile(r('robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`);

console.log(`✓ index.html, 404.html, ${projekte.length} Projektseiten, projects.css, sitemap.xml, robots.txt geschrieben.`);
console.log(`  CSP-Hash Inline-Skript: ${INLINE_HASH}`);
const todos = [...new Set([JSON.stringify(site), JSON.stringify(projekte)].join(' ').match(/\[\[TODO:[^\]]*\]\]/g) || [])];
if (todos.length) console.log(`  Offene TODOs (${todos.length}):\n  - ${todos.join('\n  - ')}`);
