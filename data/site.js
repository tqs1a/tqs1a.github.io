/**
 * Zentrale Konfiguration und alle Texte der Website.
 *
 * - Studio-Name, E-Mail und Ort NUR hier ändern.
 * - {name} in Texten wird automatisch durch site.name ersetzt.
 * - Danach `node scripts/build-projects.mjs` ausführen: Das Skript schreibt
 *   die Texte auch in index.html und 404.html, damit sie ohne JavaScript da sind.
 * - Für eine englische Version später ein zweites Objekt `copyEn` anlegen.
 */

export const site = {
  name: 'Nordform',
  url: 'https://tqs1a.github.io',
  email: '[[TODO: E-MAIL]]',
  ort: '[[TODO: ORT, z. B. „aus Hannover“]]',
  vorname: '[[TODO: VORNAME]]',
  antwortzeit: '[[TODO: ZEITRAUM]]',
  themeColor: '#0A2540',
  // Impressum und Datenschutz später hier eintragen, z. B.
  // { label: 'Impressum', href: '/impressum.html' }
  legalLinks: [],
};

export const copy = {
  skipLink: 'Zum Inhalt springen',
  nav: {
    referenzen: 'Referenzen',
    leistungen: 'Leistungen',
    prozess: 'Prozess',
    ueber: 'Über mich',
    kontakt: 'Kontakt',
    menuOpen: 'Menü öffnen',
    menuClose: 'Menü schließen',
    zurueck: 'Alle Referenzen',
  },
  seo: {
    title: '{name} – Webdesign & Webentwicklung',
    description:
      'Individuelle Websites für Unternehmen. Referenzen, Leistungen und Kontakt von {name}, von Hand gestaltet und entwickelt.',
  },
  hero: {
    eyebrow: 'Webdesign & Webentwicklung {ort}',
    titleBefore: 'Websites, die Ihr Unternehmen',
    titleAccent: 'richtig zeigen.',
    sub: '{name} entwirft und entwickelt individuelle Websites für Unternehmen. Klar gestaltet, schnell und von Hand programmiert, ohne Baukasten.',
    ctaPrimary: 'Projekt anfragen',
    ctaSecondary: 'Referenzen ansehen',
    clientsLabel: 'Ausgewählte Kunden',
  },
  referenzen: {
    eyebrow: 'Referenzen',
    title: 'Echte Projekte. Echte Unternehmen.',
    intro:
      'Eine Auswahl der Websites, die ich für meine Kunden entwickelt habe. Öffnen Sie ein Projekt, um Aufgabe, Lösung und Ergebnis zu sehen.',
    ctaProjekt: 'Projekt ansehen',
    ctaLive: 'Live ansehen',
  },
  leistungen: {
    eyebrow: 'Leistungen',
    title: 'Alles aus einer Hand.',
    titleSub: 'Vom ersten Entwurf bis zum Livegang.',
    items: [
      {
        id: 'design',
        title: 'Konzept & Design',
        text: 'Ich übersetze Ihre Marke in ein klares, modernes Erscheinungsbild mit Struktur, Typografie, Farben und Details, die zusammenpassen.',
      },
      {
        id: 'code',
        title: 'Entwicklung',
        text: 'Selbst geschriebener Code statt Baukasten. Schnell, sicher und auf jedem Gerät sauber dargestellt.',
      },
      {
        id: 'speed',
        title: 'Performance & Auffindbarkeit',
        text: 'Kurze Ladezeiten und eine saubere technische Grundlage, damit Ihre Website gefunden wird und sich gut anfühlt.',
      },
      {
        id: 'care',
        title: 'Betreuung',
        text: 'Auch nach dem Livegang erreichbar für Änderungen, Erweiterungen und Pflege.',
      },
    ],
  },
  prozess: {
    eyebrow: 'Ablauf',
    title: 'Von der ersten Idee zur fertigen Website.',
    steps: [
      { nr: '01', title: 'Kennenlernen', text: 'In einem kurzen Gespräch klären wir Ziele, Zielgruppe und Anforderungen.' },
      { nr: '02', title: 'Konzept & Design', text: 'Sie sehen früh, wohin die Reise geht: Aufbau und Gestaltung stehen vor der Umsetzung.' },
      { nr: '03', title: 'Umsetzung', text: 'Ich entwickle Ihre Website. Sie sehen Zwischenstände und geben Feedback.' },
      { nr: '04', title: 'Launch & Betreuung', text: 'Test, Livegang und Übergabe. Danach bin ich weiter für Sie da.' },
    ],
  },
  ueber: {
    eyebrow: 'Über mich',
    title: 'Der Mensch hinter {name}.',
    text: 'Ich bin {vorname}, Webentwickler {ort}. Ich baue Websites für Unternehmen, bei denen Gestaltung und Technik zusammenpassen müssen. Sie sprechen direkt mit mir, nicht mit einer Agentur-Hierarchie, und bekommen eine Website, hinter der ich persönlich stehe.',
    // Nur berechnete oder belegbare Kennzahlen. Werte kommen aus projects.json.
    statReferenzen: 'Referenzprojekte',
    statBranchen: 'Branchen',
  },
  kontakt: {
    title: 'Lassen Sie uns über Ihr Projekt sprechen.',
    text: 'Schreiben Sie mir kurz, worum es geht. Ich melde mich in der Regel innerhalb von {antwortzeit}.',
    ctaPrimary: 'Projekt anfragen',
    ctaCopy: 'E-Mail kopieren',
    toast: 'E-Mail-Adresse kopiert',
    mailSubject: 'Projektanfrage',
  },
  footer: {
    claim: 'Websites mit Anspruch.',
    top: 'Nach oben',
  },
  projekt: {
    aufgabe: 'Aufgabe',
    loesung: 'Lösung',
    ergebnis: 'Ergebnis',
    jahr: 'Jahr',
    leistungen: 'Leistungen',
    technik: 'Technik',
    umfang: 'Umfang',
    galerie: 'Desktop und Smartphone',
    live: 'Live ansehen',
    liveFehlt: 'Live-Adresse folgt',
    seoTitle: '{projekt} – Referenz von {name}',
    highlights: 'Besonderheiten',
    naechstes: 'Nächstes Projekt',
  },
  notFound: {
    title: 'Diese Seite gibt es nicht.',
    cta: 'Zur Startseite',
  },
};

/** Ersetzt {name}, {ort}, {vorname}, {antwortzeit} durch die Werte aus `site`. */
export function fill(text) {
  return String(text).replace(/\{(\w+)\}/g, (m, key) => (key in site ? site[key] : m));
}
