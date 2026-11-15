# Studio-Website (tqs1a.github.io)

Statische Website ohne Build-Schritt: HTML, CSS, JavaScript (ES-Module), GSAP, Lenis und ein eigener WebGL-Shader. Alles liegt selbst gehostet im Repo, ohne externe Anfragen und ohne Cookies.

- **Projekt hinzufügen:** Logo und Screenshots nach `assets/img/projects/<slug>/` legen, in `data/projects.json` einen Eintrag ergänzen und `node scripts/build-projects.mjs` ausführen (Node ≥ 18, keine Pakete nötig). Das Skript erzeugt Karten, Kundenstreifen, Projektseiten und `sitemap.xml`.
- **Texte ändern:** Studio-Name, E-Mail, Ort und alle Texte stehen in `data/site.js`. Danach ebenfalls `node scripts/build-projects.mjs` ausführen, damit die Texte auch im HTML stehen.
- **Impressum und Datenschutz:** Seiten anlegen und in `data/site.js` unter `legalLinks` eintragen, dann neu bauen.
- **Lokal ansehen:** im Projektordner `python -m http.server` (oder `npx serve`) starten und `http://localhost:8000` öffnen.
- **GitHub Pages aktivieren:** Settings → Pages → Source „Deploy from a branch“ → Branch `main`, Ordner `/ (root)`.
- **OG-Bild:** Nach einer Namensänderung `scripts/og-image.html` lokal öffnen und neu als `assets/img/og-image.jpg` (1200×630) speichern.
- **Porträt:** Liegt `assets/img/portrait.jpg` vor, im Abschnitt „Über mich“ in `index.html` das Avatar-Element durch ein `<img>` ersetzen.
- **Testhilfen:** `?hero=css` erzwingt den CSS-Hintergrund, `?hero=slow` simuliert ein langsames Gerät.
