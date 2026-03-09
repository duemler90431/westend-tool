# Westendhotel Angebotstool – Projektdokumentation

**Stand:** 09. März 2026  
**Repository:** https://github.com/duemler90431/westend-tool  
**Live-URL:** https://duemler90431.github.io/westend-tool/  
**Betreiber:** Hotel Westend, Karl-Martell-Str. 42–44, 90431 Nürnberg

---

## Projektübersicht

Browser-basiertes Tool zur Erstellung und Verwaltung von Hotelangeboten und Buchungsbestätigungen. Gehostet auf GitHub Pages, E-Mail-Versand über Brevo API. Kein Backend – alles läuft clientseitig im Browser. Einzige Ausnahme: Cloudflare Worker als E-Mail-Proxy für die Gast-Bestätigungsseite.

### Dateien im Repository

| Datei | Zeilen | Beschreibung |
|---|---|---|
| `index.html` | ~1453 | Haupttool – Angebotserstellung & E-Mail-Versand |
| `confirm.html` | ~529 | Gast-Bestätigungsseite (verlinkt aus Angebots-E-Mail) |
| `wh-logo_weiss_transparent.png` | – | Logo (weiß/transparent) für confirm.html Header + E-Mail |
| `AGB_westendhotel2025.pdf` | – | AGB-Dokument (verlinkt in confirm.html) |

### Externe Infrastruktur

| Dienst | URL / Name | Zweck |
|---|---|---|
| Cloudflare Worker | `westend-brevo-proxy.dd-f19.workers.dev` | E-Mail-Proxy für confirm.html (Brevo API-Key serverseitig geschützt) |
| Brevo API | `api.brevo.com/v3/smtp/email` | Transaktionaler E-Mail-Versand |
| GitHub Pages | `duemler90431.github.io/westend-tool/` | Hosting |

---

## index.html – Angebotstool

### Formular-Sektionen (linke Spalte)

**1. Gastinformationen / Besteller**
- Anrede (Herr / Frau / Firma/Gruppe), Nachname*, Vorname, E-Mail*, Firma/Gruppe, Telefon
- Aufklappbar: Abweichende Rechnungsadresse (Name, Kostenstelle/Zusatz, Straße, PLZ/Ort)
- Logik: Wenn ein Gastname bei der Zimmerkonfiguration eingetragen wird, fungieren diese Daten als Besteller-Informationen

**2. Aufenthalt**
- Anreise* (Datum), Abreise* (Datum)
- Automatische Berechnung der Nächte
- Verpflegung: "Nur Übernachtung" oder "inkl. Frühstück" (15,00 €/Pers./Nacht)
- Angebotsgültigkeit: Dropdown mit "Datum wählen" (Default: heute+7 Tage) oder "Freibleibend"

**3. Zimmerkonfiguration**
- Dynamische Zeilen (hinzufügen/entfernen)
- Pro Zeile: Anzahl, Kategorie (Dropdown), Preis/Nacht €, Personen/Zi.
- **Gastname** (optional) – nur wenn abweichend vom Besteller. Wenn leer = Besteller ist Gast
- Aufklappbar pro Zeile: Abweichende An-/Abreise (für Split-Buchungen)
- Kategorien: `BASIC ROOM`, `MORE ROOM`, `Studio mit Kitchenette`
- Gesamtpreis-Zusammenfassung unten (Zimmer + ggf. Frühstück)

**4. Stornobedingungen**
- 4 Optionen als Radio-Buttons:
  - **Regulär:** Kostenlos bis 48h vor Anreise (18:00 Uhr)
  - **Messe / Sonderveranstaltung:** Kostenlos bis 42 Tage vor Anreise
  - **Gruppe (ab 4 Zimmer):** Kostenlos bis 14 Tage vor Anreise
  - **NON-CLX (nicht erstattungsfähig):** Sonderpreis, keine Stornierung

**5. Hinweise & Absender**
- Hinweise (Freitext, erscheint in E-Mail)
- Bemerkungen (Freitext, erscheint in E-Mail)
- Mitarbeitername (Absender-Signatur): Rezeption, Daniel Dümler, Yvonne Dümler, Nathalie Faverey
- CC-Adresse (optional)

### E-Mail-Vorschau (rechte Spalte)

- Live-Vorschau der generierten E-Mail
- Umschalter: **Angebot** (gold) / **Bestätigung** (grün)
- Sprachumschalter: **DE** / **EN**
- Brevo API-Key Eingabe (gespeichert in localStorage)
- Buttons: "E-Mail senden" (via Brevo), "HTML kopieren" (Zwischenablage)

### E-Mail-Inhalt

Die generierte E-Mail enthält:
- Hotel-Header (dunkelgrau, #3a3a3a) mit Hotelname und Adresse
- Logo als gehostete PNG-URL (nicht Base64, für Outlook-Kompatibilität)
- Typ-Banner (gold für Angebot, grün für Bestätigung)
- Anrede und Einleitungstext (DE/EN)
- Besteller-Hinweis (wenn Gastname vorhanden): "(Besteller – Gast siehe Zimmerkonfiguration)"
- Aufenthaltstabelle (Anreise, Abreise, Dauer)
- Zimmerkonfiguration-Tabelle mit Kategorie, Belegung, Preis/Nacht, Gesamt
  - Gastname pro Zeile: "↳ Gast: [Name]" (wenn abweichend)
  - Abweichende Daten pro Zeile (wenn Split-Buchung)
- Preiszusammenfassung (Zimmerkosten + ggf. Frühstück = Gesamt)
  - Frühstück-Aufschlüsselung bei Split-Buchungen: pro Zimmerzeile einzeln
- Gültigkeits-Banner (nur bei Angebot): Datum oder "Freibleibend"
- **"Angebot annehmen"-Button** (nur bei Angebot) → Link zu confirm.html
- Hinweise und Bemerkungen (wenn vorhanden)
- Stornobedingungen-Box
- Abschlusstext + Mitarbeiter-Signatur
- Hotel-Footer (Adresse, Kontakt, Links)
- Impressum (gem. § 5 TMG)

### URL-Parameter (Eingangs-Prefill)

Das Tool akzeptiert zwei Prefill-Modi:

**Modus 1 – Einfache Parameter (Power Automate):**
- `von` → E-Mail-Adresse
- `name` → Nachname
- `betreff` → (für Banner-Anzeige)
- Zeigt blaues Banner: "Neue Buchungsanfrage eingegangen"

**Modus 2 – Vollständiger Prefill aus Angebotsannahme:**
- `prefill` → Base64-kodiertes JSON mit allen Buchungsdaten
- Enthält: `mode`, `anrede`, `name`, `vorname`, `email`, `firma`, `telefon`, `anreise`, `abreise`, `zimmer` (inkl. Preis im Format `@89.00`), `gesamt`, `storno`, `r_name`, `r_strasse`, `r_plzort`, `r_zusatz`, `bemerkungen`
- Setzt automatisch Modus auf "Bestätigung"
- Füllt alle Felder vor: Gastdaten, Zeitraum, Zimmer (mit Preisen und Gastnamen), Storno, Rechnungsadresse
- Zeigt grünes Banner: "Angebotsannahme – Buchungsbestätigung vorbereitet"

### Confirm-URL Format

Die URL zum "Angebot annehmen"-Button nutzt **Base64-kodiertes JSON** als einzelnen `d`-Parameter:

```
confirm.html?d=eyJsYW5nIjoiZGUiLCJhbnJlZGUiOi...
```

Das JSON-Objekt (`confirmData`) enthält:
`lang`, `anrede`, `name`, `vorname`, `email`, `firma`, `telefon`, `anreise`, `abreise`, `zimmer` (formatiert als "1x BASIC ROOM @89.00 [Gast: Name], 2x MORE ROOM @109.00"), `gesamt`, `r_name`, `r_strasse`, `r_plzort`, `r_zusatz`, `storno`

Grund für Base64: Brevo Link-Tracking hat bei vielen URL-Parametern Daten abgeschnitten.

### Freibleibend-Option

Dropdown bei "Angebot gültig bis" mit zwei Optionen:
- **"Datum wählen"**: zeigt Datumsfeld (Default: heute+7 Tage)
- **"Freibleibend"**: versteckt Datumsfeld, zeigt in E-Mail:
  - DE: "Dieses Angebot ist **freibleibend** und vorbehaltlich der Verfügbarkeit zum Zeitpunkt der Buchung."
  - EN: "This offer is **subject to availability** at the time of booking."

---

## confirm.html – Gast-Bestätigungsseite

### Ablauf

1. Gast klickt "Angebot annehmen" in der E-Mail
2. confirm.html öffnet sich, dekodiert den Base64-`d`-Parameter
3. Zeigt alle Buchungsdetails zur Überprüfung an (Preise `@XX.XX` werden aus Anzeige entfernt)
4. Gast kann Bemerkungen hinzufügen
5. Gast muss AGB-Checkbox akzeptieren
6. Klick auf "Angebot verbindlich bestätigen" → E-Mail an Hotel via Cloudflare Worker

### Daten-Dekodierung

- **Primär:** Base64 `d`-Parameter → JSON.parse(atob(...))
- **Fallback:** Legacy URL-Parameter einzeln auslesen (Rückwärtskompatibilität)

### Angezeigte Sektionen

- **Gastinformation:** Name, E-Mail, Firma, Telefon
- **Aufenthalt:** Anreise, Abreise, Zimmer (ohne Preisangaben)
- **Rechnungsadresse:** (wenn vorhanden)
- **Gesamtbetrag**
- **Stornobedingungen** (Titel + Text basierend auf gewählter Stornoart)
- **Bemerkungen** (Freitext-Eingabe für den Gast)
- **AGB-Checkbox** + Bestätigungs-Button

### Bestätigungs-E-Mail an Hotel

Wird gesendet an: `info@hotelwestend.de`

**Versand über Cloudflare Worker Proxy:**
- URL: `https://westend-brevo-proxy.dd-f19.workers.dev`
- confirm.html sendet POST-Request an den Worker (kein API-Key im Client-Code)
- Worker leitet mit serverseitig gespeichertem Brevo API-Key an Brevo API weiter
- Sender: "westendhotel nürnberg – Angebotsannahme" / info@hotelwestend.de
- Reply-To: E-Mail-Adresse des Gastes
- HTML-E-Mail mit Gastinfo, Buchungsdetails, Rechnungsadresse, Bemerkungen, Storno, AGB-Hinweis
- **"Buchungsbestätigung erstellen"-Button**: Öffnet index.html mit vollständigem Prefill aller Buchungsdaten

### Erfolgs-/Fehler-Anzeige

- Erfolg: "Vielen Dank!" / "Thank you!" mit Konfetti-Icon
- Fehler: Hinweis mit Kontaktdaten

---

## Cloudflare Worker – E-Mail-Proxy

### Übersicht

Serverloser Proxy-Dienst auf Cloudflare Workers (Free-Tier, kostenlos). Löst das Problem, dass der Brevo API-Key nicht im öffentlichen GitHub-Code stehen kann.

### Technische Details

- **Name:** `westend-brevo-proxy`
- **URL:** `https://westend-brevo-proxy.dd-f19.workers.dev`
- **Cloudflare Account:** `Dd@hotelwestend.de`
- **Secret:** `BREVO_API_KEY` (verschlüsselt gespeichert in Cloudflare Worker Settings → Variables and Secrets)

### Funktionsweise

1. confirm.html sendet POST-Request mit E-Mail-Daten an Worker-URL
2. Worker validiert: Empfänger und Sender müssen `info@hotelwestend.de` sein
3. Worker fügt den serverseitig gespeicherten Brevo API-Key hinzu
4. Worker leitet Request an `api.brevo.com/v3/smtp/email` weiter
5. Brevo-Response wird an confirm.html zurückgegeben

### Sicherheit

- **CORS:** Nur Requests von `duemler90431.github.io`, `localhost`, `127.0.0.1` erlaubt
- **Empfänger-Validierung:** Nur E-Mails an `info@hotelwestend.de` möglich
- **Sender-Validierung:** Nur `info@hotelwestend.de` als Absender erlaubt
- **API-Key:** Nie im Client-Code sichtbar, nur als verschlüsseltes Secret im Worker
- **Methoden:** Nur POST und OPTIONS (CORS Preflight) erlaubt

### Wartung

Bei API-Key-Rotation (neuer Brevo-Key): Cloudflare Dashboard → Workers & Pages → westend-brevo-proxy → Settings → Variables and Secrets → `BREVO_API_KEY` bearbeiten → Deploy.

---

## Technische Details

### Sprachen (i18n)

Vollständige Zweisprachigkeit DE/EN für:
- Alle Formularlabels und Platzhalter
- E-Mail-Texte (Anrede, Einleitung, Abschluss, Tabellen-Header)
- Stornobedingungen (4 Varianten × 2 Sprachen)
- confirm.html (Seitentexte, E-Mail an Hotel)

Umschaltung über DE/EN Buttons in index.html, in confirm.html via `lang`-Feld im JSON.

### Brevo API Integration

**index.html (Rezeptions-Tool):**
- Endpoint: `https://api.brevo.com/v3/smtp/email`
- API-Key: Nutzereingabe, gespeichert in `localStorage` unter `westend_brevo_key`
- Absender: `westendhotel nürnberg <info@hotelwestend.de>`

**confirm.html (Gast-Bestätigung):**
- Endpoint: `https://westend-brevo-proxy.dd-f19.workers.dev` (Cloudflare Worker)
- Kein API-Key im Client – Worker fügt ihn serverseitig hinzu

**Wichtig:** API-Key darf **nie** in öffentlichen Code auf GitHub committed werden. GitHub Secret Scanning erkennt Brevo/Sendinblue-Keys automatisch und meldet sie an Brevo, woraufhin Brevo den Key sofort deaktiviert.

### DNS-Konfiguration (hotelwestend.de)

Für E-Mail-Zustellbarkeit konfiguriert bei e-ventis (Webhoster):
- **SPF:** `v=spf1 mx a ip4:212.114.252.52 ip4:138.201.127.42 include:spf.protection.outlook.com include:sendinblue.com ~all`
- **DKIM:** `brevo1._domainkey` → CNAME → `b1.hotelwestend-de.dkim.brevo.com`, `brevo2._domainkey` → CNAME → `b2.hotelwestend-de.dkim.brevo.com`
- **DMARC:** `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com`
- **Brevo-Code:** `brevo-code:1306ddbe7095decbced2958e034a88a4`

**DKIM-Status (09.03.2026):** PENDING – Webhoster (Sebastian Tanzer, e-ventis) muss DKIM-Einträge von **TXT auf CNAME** ändern. Danach in Brevo → Einstellungen → Domains → "Authentifizieren" klicken.

### Styling / Branding

- Schriften: DM Sans (Body), Playfair Display (Hotel-Name)
- Farben: Navy (#3a3a3a), Gold (#c9983a), Cream (#faf8f4), Grün (#16a34a)
- Logo: `wh-logo_weiss_transparent.png` (weißer Schriftzug auf transparentem Hintergrund)
- confirm.html Header: Logo als gehostete PNG von GitHub Pages
- index.html Header: Logo als Base64-Data-URI (nur Browser-Anzeige)
- E-Mail-Logo: Gehostete PNG-URL (für Outlook-Kompatibilität, kein Base64)

### Frühstücks-Berechnung

- Preis: 15,00 €/Person/Nacht (`FRUEHSTUECK_PREIS`)
- Berechnung: `zimmer.reduce((sum, z) => sum + (z.anzahl * z.personen * FRUEHSTUECK_PREIS * (z.nights || nights)), 0)`
- Anzeige bei Split-Buchungen: Pro-Zimmer-Aufschlüsselung, z.B. "Frühstück (1 Pers. × 4 Nächte + 1 Pers. × 4 Nächte)"
- Betrag immer korrekt über `z.nights` pro Zimmerzeile

### Besteller/Gast-Logik

- Feld "Gastname" pro Zimmerzeile (optional)
- Wenn leer: Person aus "Gastinformationen / Besteller" = anreisender Gast
- Wenn ausgefüllt: Person aus "Gastinformationen / Besteller" = Besteller, Gastname = anreisender Gast
- Im E-Mail: "↳ Gast: [Name]" unter der Zimmerkategorie
- Besteller-Hinweis: "(Besteller – Gast siehe Zimmerkonfiguration)" / "(Booker – guest see room configuration)"
- Im Confirm-Link: Gastname als Teil des Zimmer-Strings "[Gast: Name]"

### Zimmer-String Format

Der Zimmer-String im Base64-kodierten JSON enthält optional Preis und Gastname:

```
1x BASIC ROOM @89.00 [Gast: Michael Huber], 2x MORE ROOM @109.00
```

- `@89.00` – Preis pro Nacht (wird in Gast-Anzeige/E-Mail automatisch entfernt, nur für Prefill relevant)
- `[Gast: Name]` – Gastname wenn abweichend vom Besteller

---

## Datenfluss

```
[Rezeption füllt index.html aus]
        ↓
[Klick "E-Mail senden"]
        ↓
[Brevo API sendet Angebots-E-Mail an Gast]
        ↓
[Gast klickt "Angebot annehmen" in E-Mail]
        ↓
[confirm.html öffnet sich mit Base64-Daten]
        ↓
[Gast prüft, fügt Bemerkungen hinzu, akzeptiert AGB]
        ↓
[Klick "Bestätigen"]
        ↓
[Cloudflare Worker → Brevo API → E-Mail an info@hotelwestend.de]
        ↓
[Hotel-E-Mail enthält Button "Buchungsbestätigung erstellen"]
        ↓
[Klick öffnet index.html mit allen Daten vorausgefüllt, Modus: Bestätigung]
        ↓
[Rezeption prüft Daten, klickt "E-Mail senden"]
        ↓
[Brevo API sendet Buchungsbestätigung an Gast]
```

---

## Bekannte Einschränkungen / Hinweise

- **Datei-Upload bei Claude:** confirm.html wird beim Upload regelmäßig bei ~460–515 Zeilen abgeschnitten. Immer Vollständigkeit prüfen (muss mit `</html>` enden).
- **Cloudflare Email Protection:** GitHub Pages nutzt Cloudflare, das E-Mail-Adressen im HTML verschleiert (`[email protected]`). Im aktuellen Code sind keine E-Mail-Adressen im HTML-Body, die davon betroffen wären – alle werden dynamisch per JavaScript generiert.
- **Brevo Link-Tracking:** Kann URL-Parameter verfälschen. Gelöst durch Base64-Kodierung als einzelner `d`-Parameter.
- **DKIM (Stand 09.03.2026):** Webhoster muss DKIM-Einträge von TXT auf CNAME ändern. Bis dahin können E-Mails im Spam landen.
- **GitHub Secret Scanning:** API-Keys dürfen nie in den Code committed werden – GitHub erkennt sie und Brevo deaktiviert sie sofort automatisch.
- **Cloudflare Worker Free-Tier:** 100.000 Requests/Tag, mehr als ausreichend für den Hotelbetrieb.

---

## Änderungshistorie

| Datum | Änderung |
|---|---|
| 09.03.2026 | **Cloudflare Worker** als E-Mail-Proxy für confirm.html (Brevo API-Key serverseitig geschützt) |
| 09.03.2026 | **"Buchungsbestätigung erstellen"-Button** in Hotel-Angebotsannahme-E-Mail mit vollständigem Prefill |
| 09.03.2026 | **Prefill-Modus** in index.html: Alle Felder inkl. Zimmerpreise aus Angebotsannahme vorausfüllen |
| 09.03.2026 | **Freibleibend-Option** bei "Angebot gültig bis" (Datum oder freibleibend) |
| 09.03.2026 | **Mitarbeiter-Liste** aktualisiert (Rezeption, Daniel Dümler, Yvonne Dümler, Nathalie Faverey) |
| 09.03.2026 | **Outlook Logo-Fix**: E-Mail-Logo von Base64 auf gehostete PNG-URL umgestellt |
| 09.03.2026 | **Zimmer-String erweitert** um Preis-Info `@XX.XX` für Prefill-Übergabe |
| 04.03.2026 | Gastname-Feld pro Zimmerzeile hinzugefügt (Besteller/Gast-Logik) |
| 04.03.2026 | Sektion umbenannt: "Gastinformationen" → "Gastinformationen / Besteller" |
| 03.03.2026 | Base64-URL-Kodierung für Confirm-Link (statt URLSearchParams) |
| 03.03.2026 | Stornobedingungen in confirm.html + Hotel-E-Mail + Mailto-Fallback |
| 03.03.2026 | Logo (PNG) in confirm.html Header eingefügt |
| 03.03.2026 | Frühstücks-Anzeige-Fix bei Split-Buchungen (pro Zimmerzeile) |
| 03.03.2026 | DNS/DKIM/SPF/DMARC-Einträge für Brevo bei e-ventis eingerichtet |
| Früher | Brevo API Integration, DE/EN Toggle, Impressum, Rechnungsadresse, Storno-Auswahl, Split-Buchungen, Power Automate URL-Parameter |
