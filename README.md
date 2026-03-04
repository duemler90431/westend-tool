# Westendhotel Angebotstool – Projektdokumentation

**Stand:** 04. März 2026  
**Repository:** https://github.com/duemler90431/westend-tool  
**Live-URL:** https://duemler90431.github.io/westend-tool/  
**Betreiber:** Hotel Westend, Karl-Martell-Str. 42–44, 90431 Nürnberg

---

## Projektübersicht

Browser-basiertes Tool zur Erstellung und Verwaltung von Hotelangeboten und Buchungsbestätigungen. Gehostet auf GitHub Pages, E-Mail-Versand über Brevo API. Kein Backend, kein Server – alles läuft clientseitig im Browser.

### Dateien im Repository

| Datei | Zeilen | Beschreibung |
|---|---|---|
| `index.html` | ~1332 | Haupttool – Angebotserstellung und E-Mail-Versand |
| `confirm.html` | ~524 | Gast-Bestätigungsseite (verlinkt aus Angebots-E-Mail) |
| `wh-logo_weiss_transparent.png` | – | Logo (weiß/transparent) für confirm.html Header |
| `AGB_westendhotel2025.pdf` | – | AGB-Dokument (verlinkt in confirm.html) |

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
- Angebotsgültigkeit (Datum, optional)

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
- Mitarbeitername (Absender-Signatur)
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
- Typ-Banner (gold für Angebot, grün für Bestätigung)
- Anrede und Einleitungstext (DE/EN)
- Besteller-Hinweis (wenn Gastname vorhanden): "(Besteller – Gast siehe Zimmerkonfiguration)"
- Aufenthaltstabelle (Anreise, Abreise, Dauer)
- Zimmerkonfiguration-Tabelle mit Kategorie, Belegung, Preis/Nacht, Gesamt
  - Gastname pro Zeile: "↳ Gast: [Name]" (wenn abweichend)
  - Abweichende Daten pro Zeile (wenn Split-Buchung)
- Preiszusammenfassung (Zimmerkosten + ggf. Frühstück = Gesamt)
  - Frühstück-Aufschlüsselung bei Split-Buchungen: pro Zimmerzeile einzeln
- Gültigkeits-Banner (nur bei Angebot, wenn Datum gesetzt)
- **"Angebot annehmen"-Button** (nur bei Angebot) → Link zu confirm.html
- Hinweise und Bemerkungen (wenn vorhanden)
- Stornobedingungen-Box
- Abschlusstext + Mitarbeiter-Signatur
- Hotel-Footer (Adresse, Kontakt, Links)
- Impressum (gem. § 5 TMG)

### URL-Parameter (Eingangs-Prefill)

Das Tool akzeptiert URL-Parameter zum Vorausfüllen:
- `von` → E-Mail-Adresse
- `name` → Nachname
- `betreff` → (für Banner-Anzeige)

Genutzt für Power Automate Integration (SharePoint → E-Mail-Erkennung → Tool-Link).

### Confirm-URL Format

Die URL zum "Angebot annehmen"-Button nutzt **Base64-kodiertes JSON** als einzelnen `d`-Parameter:

```
confirm.html?d=eyJsYW5nIjoiZGUiLCJhbnJlZGUiOi...
```

Das JSON-Objekt (`confirmData`) enthält:
`lang`, `anrede`, `name`, `vorname`, `email`, `firma`, `telefon`, `anreise`, `abreise`, `zimmer` (formatiert als "1x BASIC ROOM [Gast: Name], 2x MORE ROOM"), `gesamt`, `r_name`, `r_strasse`, `r_plzort`, `r_zusatz`, `storno`

Grund für Base64: Brevo Link-Tracking hat bei vielen URL-Parametern Daten abgeschnitten.

---

## confirm.html – Gast-Bestätigungsseite

### Ablauf

1. Gast klickt "Angebot annehmen" in der E-Mail
2. confirm.html öffnet sich, dekodiert den Base64-`d`-Parameter
3. Zeigt alle Buchungsdetails zur Überprüfung an
4. Gast kann Bemerkungen hinzufügen
5. Gast muss AGB-Checkbox akzeptieren
6. Klick auf "Angebot verbindlich bestätigen" → E-Mail an Hotel

### Daten-Dekodierung

- **Primär:** Base64 `d`-Parameter → JSON.parse(atob(...))
- **Fallback:** Legacy URL-Parameter einzeln auslesen (Rückwärtskompatibilität)

### Angezeigte Sektionen

- **Gastinformation:** Name, E-Mail, Firma, Telefon
- **Aufenthalt:** Anreise, Abreise, Zimmer
- **Rechnungsadresse:** (wenn vorhanden)
- **Gesamtbetrag**
- **Stornobedingungen** (Titel + Text basierend auf gewählter Stornoart)
- **Bemerkungen** (Freitext-Eingabe für den Gast)
- **AGB-Checkbox** + Bestätigungs-Button

### Bestätigungs-E-Mail an Hotel

Wird gesendet an: `info@hotelwestend.de`

**Versand-Methode 1 – Brevo API:**
- Nutzt den gespeicherten `westend_brevo_key` aus localStorage
- Sender: "westendhotel nürnberg – Angebotsannahme" / info@hotelwestend.de
- Reply-To: E-Mail-Adresse des Gastes
- HTML-E-Mail mit Gastinfo, Buchungsdetails, Rechnungsadresse, Bemerkungen, Storno, AGB-Hinweis

**Versand-Methode 2 – Mailto-Fallback:**
- Wenn kein Brevo-Key vorhanden
- Öffnet lokalen E-Mail-Client mit vorausgefülltem Subject + Body
- Enthält alle relevanten Daten als Plain-Text inkl. Stornobedingungen

### Erfolgs-/Fehler-Anzeige

- Erfolg: "Vielen Dank!" / "Thank you!" mit Konfetti-Icon
- Fehler: Hinweis mit Kontaktdaten

---

## Technische Details

### Sprachen (i18n)

Vollständige Zweisprachigkeit DE/EN für:
- Alle Formularlabels und Platzhalter
- E-Mail-Texte (Anrede, Einleitung, Abschluss, Tabellen-Header)
- Stornobedingungen (4 Varianten × 2 Sprachen)
- confirm.html (Seitentexte, E-Mail an Hotel, Mailto-Fallback)

Umschaltung über DE/EN Buttons in index.html, in confirm.html via `lang`-Feld im JSON.

### Brevo API Integration

- Endpoint: `https://api.brevo.com/v3/smtp/email`
- API-Key: Nutzereingabe, gespeichert in `localStorage` unter `westend_brevo_key`
- Absender: `westendhotel nürnberg <info@hotelwestend.de>`
- Domain: `hotelwestend.de` muss in Brevo authentifiziert sein (SPF, DKIM, DMARC)

### DNS-Konfiguration (hotelwestend.de)

Für E-Mail-Zustellbarkeit konfiguriert bei e-ventis (Webhoster):
- **SPF:** `v=spf1 mx a ip4:212.114.252.52 ip4:138.201.127.42 include:spf.protection.outlook.com include:sendinblue.com ~all`
- **DKIM:** `brevo1._domainkey` → `b1.hotelwestend.de-dkim.brevo.com`, `brevo2._domainkey` → `b2.hotelwestend.de-dkim.brevo.com`
- **DMARC:** `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com`
- **Brevo-Code:** `brevo-code:1306ddbe7095decbced2958e034a88a4`
- **Status (04.03.2026):** Domain in Brevo noch "Nicht authentifiziert" – DNS-Propagierung nach SPF-Korrektur läuft (bis zu 48h)

### Styling / Branding

- Schriften: DM Sans (Body), Playfair Display (Hotel-Name)
- Farben: Navy (#3a3a3a), Gold (#c9983a), Cream (#faf8f4), Grün (#16a34a)
- Logo: `wh-logo_weiss_transparent.png` (weißer Schriftzug auf transparentem Hintergrund)
- confirm.html Header: Logo als PNG von GitHub Pages
- index.html Header: Logo als Base64-Data-URI

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
[Brevo API oder Mailto-Fallback → E-Mail an info@hotelwestend.de]
```

---

## Bekannte Einschränkungen / Hinweise

- **Brevo-Key auf confirm.html:** Der Gast hat normalerweise keinen Brevo-Key in localStorage → Mailto-Fallback greift. Nur auf demselben Gerät/Browser wo der Key gespeichert wurde, funktioniert der direkte Brevo-Versand.
- **Datei-Upload bei Claude:** confirm.html wird beim Upload regelmäßig bei ~460–515 Zeilen abgeschnitten. Immer Vollständigkeit prüfen (muss mit `</html>` enden).
- **Cloudflare Email Protection:** GitHub Pages nutzt Cloudflare, das E-Mail-Adressen im HTML verschleiert (`[email protected]`). Im aktuellen Code sind keine E-Mail-Adressen im HTML-Body, die davon betroffen wären – alle werden dynamisch per JavaScript generiert.
- **Brevo Link-Tracking:** Kann URL-Parameter verfälschen. Gelöst durch Base64-Kodierung als einzelner `d`-Parameter.
- **DNS/DMARC:** Domain-Authentifizierung bei Brevo steht noch aus (Stand 04.03.2026). Bis dahin können E-Mails von confirm.html im Spam landen.

---

## Änderungshistorie

| Datum | Änderung |
|---|---|
| 04.03.2026 | Gastname-Feld pro Zimmerzeile hinzugefügt (Besteller/Gast-Logik) |
| 04.03.2026 | Sektion umbenannt: "Gastinformationen" → "Gastinformationen / Besteller" |
| 03.03.2026 | Base64-URL-Kodierung für Confirm-Link (statt URLSearchParams) |
| 03.03.2026 | Stornobedingungen in confirm.html + Hotel-E-Mail + Mailto-Fallback |
| 03.03.2026 | Logo (PNG) in confirm.html Header eingefügt |
| 03.03.2026 | Frühstücks-Anzeige-Fix bei Split-Buchungen (pro Zimmerzeile) |
| 03.03.2026 | DNS/DKIM/SPF/DMARC-Einträge für Brevo bei e-ventis eingerichtet |
| Früher | Brevo API Integration, DE/EN Toggle, Impressum, Rechnungsadresse, Storno-Auswahl, Split-Buchungen, Power Automate URL-Parameter |
