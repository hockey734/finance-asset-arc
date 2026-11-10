# Finance Asset Arc – leere Testversion

Die App startet beim ersten Öffnen im aktuellen Monat mit CHF 0.00 und ohne Positionen. Unter «Monatswerte» legst du mit «+ Portfolio» ein Institut und Portfolio zusammen mit der ersten Position an. Danach kannst du weitere Positionen, Monatsbestände, Allokationen, Netto-Einzahlungen und Wechselkurse erfassen.

## Auf GitHub Pages veröffentlichen

1. Erstelle auf GitHub ein neues Repository, zum Beispiel `finance-asset-arc-demo`.
2. Entpacke das ZIP und lade **die entpackten Dateien** auf den Branch `main` hoch. `index.html` muss im Hauptordner des Repositorys liegen. Lade auch `.nojekyll` und den Ordner `assets` hoch.
3. Öffne **Settings → Pages** und wähle **Deploy from a branch**.
4. Wähle **main** und **/(root)** und speichere.
5. Sobald GitHub die Seite bereitstellt, findest du unter **Settings → Pages** den Link unter **Visit site**. Diesen Link kannst du weitergeben.

[Offizielle Anleitung zu GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## Daten und Zugriff

Die GitHub-Pages-Testversion kann öffentlich aufgerufen werden. Sie enthält keine persönlichen Startbestände oder Reportdaten. Die Eingaben jedes Testers bleiben in seinem jeweiligen Browser und werden nicht an GitHub übertragen. Es gibt keine Anmeldung und keine Synchronisierung. Für einen Gerätewechsel kann man ein Backup exportieren und im anderen Browser importieren. Persönliche Backups gehören nicht in das Repository.

## Lokal testen

Im entpackten Ordner `python3 -m http.server 8000 --bind 127.0.0.1` ausführen und im Browser `http://127.0.0.1:8000` öffnen. Die Seite lädt den leeren Startdatensatz über HTTP. Ein direktes Öffnen der HTML-Datei per Doppelklick kann das Laden blockieren.

## Dateien

`index.html` enthält die Oberfläche, `style.css` das Layout. `app.js` steuert die Ansichten und die lokale Speicherung. Die weiteren JavaScript-Dateien enthalten Allokation, Diagramme, Monatsvergleich, Einstellungen sowie die Verarbeitung von VIAC- und Kennungsfeldern. `seed.json` ist der leere Startdatensatz. `assets` enthält das Logo. Es gibt keinen Build-Schritt.
