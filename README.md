# Projekt: Westendhotel Nürnberg – Angebotstool & Power Automate Flow

## Übersicht
Ein HTML-basiertes Angebots- und Bestätigungstool für das Westendhotel Nürnberg, gehostet auf GitHub Pages. Ein Power  Automate Flow erkennt eingehende Buchungsanfragen und sendet automatisch eine Benachrichtigung mit Link zum Tool.

---

## Komponenten

### 1. Angebotstool (HTML)
- **URL:** https://duemler90431.github.io/westend-tool/
- **GitHub Repo:** https://github.com/duemler90431/westend-tool
- **Datei:** `index.html` (einzige Datei im Repo)
- **Hosting:** GitHub Pages (kostenlos, öffentlich)

### 2. Power Automate Flow
- **Trigger:** "Bei Eingang einer neuen E-Mail (V3)" auf info@hotelwestend.de
- **Bedingung:** Betreff enthält eines der Keywords (mit ODER-Verknüpfung):
  - Anfrage, Zimmer, Angebot, Verfügbarkeit, Reservierung, Übernachtung, Gruppe, Messe, Request, Availability, Reservation
- **Aktion (Wahr):** E-Mail senden (V2) an dd@hotelwestend.de
  - Betreff: "Neue Buchungsanfrage: [Betreff]"
  - Body enthält Link mit URL-Parametern (encodeUriComponent für Sonderzeichen/Leerzeichen)
- **Aktion (Falsch):** keine

---

## Tool-Features

### Zwei Modi
1. **📁 ANGEBOT** – Angebots-E-Mail mit Preisen, Gültigkeit, Stornobedingungen
2. **✅ BESTÄTIGUNG** – Buchungsbestätigung

### Formularbereiche
- **Gastinformationen:** Anrede, Name, E-Mail, Firma, Telefon, Rechnungsadresse
- **Aufenthalt:** Anreise, Abreise, Verpflegung (ohne/mit Frühstück €15/Pers./Nacht), Angebotsgültigkeit
- **Zimmerkonfiguration:** Mehrere Kategorien möglich (BASIC ROOM, MORE ROOM, Studio mit Kitchenette), individuelle Preise, Belegung, abweichende An-/Abreise pro Zeile
- **Stornobedingungen:** Regulär, Messe, Gruppe, NON-CLX
- **Interne Notizen / Bemerkungen**

### URL-Parameter (automatische Vorausfüllung)
- `?von=email@adresse.de` → Füllt E-Mail-Feld
- `&betreff=Zimmeranfrage` → Schreibt Betreff in interne Notizen
- `&name=Mustermann` → Füllt Nachname-Feld
- Bei Aufruf mit Parametern erscheint ein blaues Info-Banner oben

### E-Mail-Versand
- **API:** Brevo (ehemals Sendinblue) Transaktional-API
- **Endpoint:** https://api.brevo.com/v3/smtp/email
- **Absender:** info@hotelwestend.de (muss in Brevo verifiziert sein!)
- **API-Key:** Wird vom Nutzer einmalig eingegeben, im localStorage gespeichert
- **Brevo-Konto:** Login unter https://app.brevo.com
- **Wichtig:** API-Key ist NICHT im Code hinterlegt (Sicherheit, da Repo öffentlich)

---

## Technische Details

### Code-Struktur (index.html)
- **Zeilen 1-7:** HTML Head, Google Fonts (Playfair Display + DM Sans)
- **Zeilen 8-340:** CSS Styling
- **Zeilen 341-605:** HTML Formular
- **Zeilen 606-1170:** JavaScript (State Management, Zimmer-Verwaltung, E-Mail-Generierung, Brevo API)

### E-Mail-Template
- Inline CSS (für E-Mail-Client-Kompatibilität)
- Fonts: DM Sans, Helvetica, Arial (Fallback)
- Farben: Gold (#c9983a), Navy (#3a3a3a), Grautöne
- Hotel-Logo als Base64 im Header

### Wichtige Funktionen im Code
- `generateEmailHTML()` – Erstellt das E-Mail-HTML
- `sendEmail()` – Sendet via Brevo API
- `addZimmerRow()` / `removeZimmerRow()` – Zimmerkonfiguration
- `selectStorno()` – Stornobedingungen
- `updatePreview()` – Live-Vorschau aktualisieren
- `showUrlParamBanner()` – URL-Parameter-Banner anzeigen

---

## Hosting & Updates

### Tool aktualisieren
1. Neue `index.html` erstellen
2. GitHub Repo öffnen → index.html anklicken → Stift-Symbol (Edit)
3. Alles markieren → Löschen → Neuen Code einfügen
4. "Commit changes" klicken
5. Nach ~1 Minute ist das Update live

### Brevo API-Key
- Einmalig im Tool eingeben → "Speichern" klicken
- Wird im Browser (localStorage) gespeichert
- Bei neuem Browser/Gerät muss der Key erneut eingegeben werden
- Key prüfen: Brevo → Einstellungen → SMTP & API → API-Schlüssel

### Absender verifizieren
- Brevo → Einstellungen → Absender & IPs → Absender
- info@hotelwestend.de muss dort als verifizierter Absender stehen

---

## Bekannte Einschränkungen
- GitHub Repository ist **öffentlich** – daher kein API-Key im Code speichern
- Brevo Free Plan: max. 300 E-Mails/Tag
- localStorage wird pro Browser/Gerät gespeichert (Key muss auf jedem Gerät einmalig eingegeben werden)
- E-Mail-Versand funktioniert nur, wenn Absender in Brevo verifiziert ist

---

## Kontakt & Accounts
- **Hotel:** Westendhotel Nürnberg, Karl-Martell-Str. 42-44, 90431 Nürnberg
- **E-Mail:** info@hotelwestend.de
- **GitHub:** duemler90431
- **Brevo:** Login unter app.brevo.com
- **Power Automate:** Über Microsoft 365 / westendhotelnbg.sharepoint.com

---

*Letzte Aktualisierung: 28. Februar 2026*
