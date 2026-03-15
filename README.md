# Westendhotel Angebotstool & Payment System – Projektdokumentation

**Stand:** 15. März 2026
**Repository:** [github.com/duemler90431/westend-tool](https://github.com/duemler90431/westend-tool)
**Live:** [booking-hotelwestend.de](https://booking-hotelwestend.de)

---

## 1. Projektübersicht

Browser-basiertes Toolset für die Rezeption des westendhotel Nürnberg. Gehostet auf Cloudflare Pages mit automatischem Deployment aus GitHub. Alle Rezeptionstools sind durch Cloudflare Access (OTP-Login) geschützt.

### Betreiber

| | |
|---|---|
| **Firma** | MORE Hospitality GmbH |
| **Geschäftsführer** | Daniel Dümler |
| **HRB** | 44922, Amtsgericht Nürnberg |
| **Adresse** | Karl-Martell-Str. 42–44, 90431 Nürnberg |
| **Hotel** | westendhotel Nürnberg (~28 Zimmer, ~8 MA) |

### Anwendungen

| Anwendung | URL | Zugang |
|---|---|---|
| **Portal (Startseite)** | `booking-hotelwestend.de/portal` | Login (OTP) |
| **Angebotstool** | `booking-hotelwestend.de/` (index.html) | Login (OTP) |
| **Payment Dashboard** | `booking-hotelwestend.de/payment-dashboard` | Login (OTP) |
| **MOTO-Tool** | `booking-hotelwestend.de/moto` | Login (OTP) |
| **Gast-Bestätigung** | `booking-hotelwestend.de/confirm` | Öffentlich |
| **Gast-Zahlung** | `booking-hotelwestend.de/pay` | Öffentlich |

---

## 2. Architektur & Infrastruktur

Das System besteht aus statischen HTML-Seiten (Cloudflare Pages) und zwei Cloudflare Workers als Backend-Proxies. Kein traditionelles Backend – alles läuft clientseitig im Browser oder serverless auf Cloudflare.

### 2.1 Hosting & Deployment

| | |
|---|---|
| **Platform** | Cloudflare Pages (Auto-Deploy aus GitHub) |
| **Repository** | `github.com/duemler90431/westend-tool` |
| **Branch** | `main` |
| **Custom Domains** | `booking-hotelwestend.de` (primär), `booking-westendhotel.de` (Redirect) |
| **DNS** | INWX (NS-Umstellung für beide Domains auf Cloudflare) |
| **SSL** | Automatisch via Cloudflare |

### 2.2 Cloudflare Workers

#### westend-brevo-proxy

| | |
|---|---|
| **URL** | `westend-brevo-proxy.dd-f19.workers.dev` |
| **Zweck** | E-Mail-Proxy für Brevo API (API-Key serverseitig geschützt) |
| **Routen** | `POST /` → E-Mail an Hotel (confirm.html) · `POST /send-guest` → E-Mail an Gast (CC-Link) |
| **Secret** | `BREVO_API_KEY` (verschlüsselt in Worker Settings) |
| **CORS** | `booking-hotelwestend.de`, `duemler90431.github.io`, `localhost` |

#### westend-payment-worker

| | |
|---|---|
| **URL** | `westend-payment-worker.dd-f19.workers.dev` |
| **Zweck** | Payment-Backend: Adyen Sessions, Tokenisierung, Belastungen, Webhooks |
| **Version** | v2.0.0 |
| **Datenbank** | D1 `westend-bookings` (SQL) |
| **CORS** | Wildcard (`*`) |
| **Cron** | Automatische Belastung fälliger Buchungen + Auto-Expire nach 7 Tagen |
| **Secrets** | `ADYEN_API_KEY`, `ADYEN_MERCHANT_ACCOUNT`, `ADYEN_CLIENT_KEY`, `ADYEN_HMAC_KEY` |

#### Payment-Worker Endpoints

| Methode | Pfad | Beschreibung |
|---|---|---|
| `POST` | `/session` | Adyen Checkout Session erstellen (Zero-Auth) |
| `POST` | `/charge` | MIT-Belastung mit gespeichertem Token |
| `POST` | `/webhook` | Adyen Webhook-Notifications empfangen |
| `GET` | `/bookings` | Alle Buchungen abrufen (optional `?status=...`) |
| `GET` | `/bookings/:id` | Einzelne Buchung abrufen |
| `PUT` | `/bookings/:id` | Buchung aktualisieren |
| `DELETE` | `/bookings/:id` | Buchung stornieren |
| `POST` | `/bookings/:id/refund` | Rückerstattung auslösen |

---

## 3. Cloudflare Access (Login-Schutz)

Alle internen Seiten sind durch Cloudflare Zero Trust Access geschützt. Login erfolgt per One-Time PIN (OTP) per E-Mail. Gästeseiten (confirm + pay) sind via Bypass-Policies öffentlich zugänglich.

### Konfiguration

| | |
|---|---|
| **Team Name** | `westend-tool` |
| **Login-URL** | `westend-tool.cloudflareaccess.com` |
| **Auth-Methode** | One-Time PIN (E-Mail-Code) |
| **Plan** | Zero Trust Free (bis 50 Seats) |

### Applications & Policies

| Application | URL / Pfad | Policy | Zugriff |
|---|---|---|---|
| Westendhotel Angebotstool | `booking-hotelwestend.de` | Hotelteam (Allow) | Nur erlaubte E-Mails (OTP) |
| Confirm (öffentlich) | `.../confirm` + `confirm.html` | Bypass öffentlich | Jeder (kein Login) |
| Payment (öffentlich) | `.../pay` + `pay.html` | Bypass öffentlich | Jeder (kein Login) |

### Erlaubte E-Mail-Adressen (Hotelteam-Policy)

- `dd@hotelwestend.de`
- `info@hotelwestend.de`

Weitere E-Mails können jederzeit ergänzt werden: Cloudflare Dashboard → Zero Trust → Access controls → Policies → Hotelteam → bearbeiten.

---

## 4. Dateien im Repository

| Datei | Zeilen | Beschreibung |
|---|---|---|
| `index.html` | ~1768 | Angebotstool – Angebote & Buchungsbestätigungen erstellen |
| `confirm.html` | ~531 | Gast-Bestätigungsseite (verlinkt aus Angebots-E-Mail) |
| `pay.html` | ~300 | Gast-Zahlungsseite (Adyen Drop-in, CC-Tokenisierung) |
| `moto.html` | ~943 | MOTO-Tool – CC-Aufnahme am Telefon + CC-Link-Versand |
| `payment-dashboard.html` | ~901 | Payment Dashboard – Buchungsübersicht, Belastungen, Refunds |
| `portal.html` | ~100 | Rezeption-Startseite mit Links zu den Tools |
| `wh-logo_weiss_transparent.png` | – | Logo (weiß/transparent) |
| `AGB_westendhotel2025.pdf` | – | AGB-Dokument |

---

## 5. Angebotstool (index.html)

Haupttool der Rezeption zur Erstellung von Angeboten und Buchungsbestätigungen. Zweisprachig (DE/EN), mit Live-Vorschau und Brevo E-Mail-Versand.

### Formular-Sektionen

1. **Gastinformationen / Besteller** – Anrede, Name, Vorname, E-Mail, Firma, Telefon, optionale Rechnungsadresse
2. **Aufenthalt** – Anreise, Abreise (automatische Nächte-Berechnung), Verpflegung (nur Übernachtung / inkl. Frühstück 15€), Angebotsgültigkeit (Datum oder Freibleibend)
3. **Zimmerkonfiguration** – Dynamische Zeilen: Anzahl, Kategorie (BASIC ROOM / MORE ROOM / Studio mit Kitchenette), Preis/Nacht, Personen, Gastname (optional), abweichende An-/Abreise (Split-Buchungen)
4. **Stornobedingungen** – 4 Optionen: Regulär (48h), Messe (42 Tage), Gruppe (14 Tage), NON-CLX (nicht erstattungsfähig)
5. **Hinweise & Absender** – Freitexte, Mitarbeiter-Auswahl (Rezeption, Daniel Dümler, Yvonne Dümler, Nathalie Faverey), CC-Adresse

### E-Mail-Vorschau

- Live-Vorschau der generierten HTML-E-Mail
- Umschalter: **Angebot** (gold) / **Bestätigung** (grün)
- Sprachumschalter: DE / EN
- CC-Toggle im Bestätigungsmodus (Kreditkarten-Link in E-Mail einbetten)
- Buttons: "E-Mail senden" (Brevo API) + "HTML kopieren" (Zwischenablage)

### Brevo API Integration

| | |
|---|---|
| **Endpoint** | `https://api.brevo.com/v3/smtp/email` |
| **API-Key** | In localStorage (`westend_brevo_key`) – nur hinter CF Access |
| **Absender** | `westendhotel nürnberg <info@hotelwestend.de>` |

### Prefill-Modi

- **Modus 1 (Power Automate):** `?von=email&name=Nachname&betreff=...` → Blaues Banner "Neue Buchungsanfrage eingegangen"
- **Modus 2 (Angebotsannahme):** `?prefill=Base64-JSON` → Grünes Banner, alle Felder vorausgefüllt, Modus Bestätigung

### Confirm-URL Format

Der "Angebot annehmen"-Button in der E-Mail nutzt Base64-kodiertes JSON als einzelnen `d`-Parameter:

```
confirm.html?d=eyJsYW5nIjoiZGUiLCJhbnJlZGUiOi...
```

Grund: Brevo Link-Tracking hat bei vielen URL-Parametern Daten abgeschnitten.

### Zimmer-String Format

```
1x BASIC ROOM @89.00 [Gast: Michael Huber], 2x MORE ROOM @109.00
```

- `@89.00` – Preis pro Nacht (wird in Gast-Anzeige entfernt, nur für Prefill)
- `[Gast: Name]` – Gastname wenn abweichend vom Besteller

---

## 6. Gast-Bestätigungsseite (confirm.html)

Wird vom Gast über den "Angebot annehmen"-Link in der E-Mail aufgerufen. Öffentlich zugänglich (kein Login).

### Ablauf

1. Gast klickt "Angebot annehmen" in der E-Mail
2. `confirm.html` öffnet sich, dekodiert den Base64-`d`-Parameter
3. Zeigt alle Buchungsdetails zur Überprüfung (Preise werden entfernt)
4. Gast kann Bemerkungen hinzufügen, muss AGB akzeptieren
5. Klick auf "Bestätigen" → E-Mail an Hotel via Cloudflare Worker (`westend-brevo-proxy`)
6. Hotel erhält E-Mail mit "Buchungsbestätigung erstellen"-Button → öffnet index.html mit Prefill

### URLs in confirm.html

| Ressource | URL |
|---|---|
| Logo | `booking-hotelwestend.de/wh-logo_weiss_transparent.png` |
| AGB | `booking-hotelwestend.de/AGB_westendhotel2025.pdf` |
| Prefill-Button | `booking-hotelwestend.de/?prefill=...` |
| E-Mail-Proxy | `westend-brevo-proxy.dd-f19.workers.dev` (POST `/`) |

---

## 7. Payment System

Tokenisiertes Kreditkartensystem für das westendhotel, basierend auf Adyen. Unterstützt Zero-Auth-Tokenisierung (eCommerce + MOTO), geplante Belastungen via Cron, und manuelles Charge/Refund.

### 7.1 Gast-Zahlungsseite (pay.html)

Wird dem Gast per E-Mail-Link geschickt. Öffentlich zugänglich. Der Gast gibt seine Kreditkartendaten über das Adyen Drop-in ein (Zero-Auth). Die Karte wird tokenisiert, nicht sofort belastet.

| | |
|---|---|
| **Adyen SDK** | Drop-in v5.65.0 (aktuell: TEST-Umgebung) |
| **Worker** | `westend-payment-worker.dd-f19.workers.dev/session` |
| **Parameter** | `?id=BOOKING_ID&name=...&checkin=...&amount=...&lang=de` |
| **DE/EN** | Vollständig zweisprachig |

### 7.2 Payment Dashboard (payment-dashboard.html)

Backend-Dashboard für die Rezeption. Zeigt alle Buchungen aus der D1-Datenbank mit Status, Token-Info und Aktionen.

**Features:**
- Statistik-Leiste: Gesamt, Ausstehend, Belastet, Fehlgeschlagen, Volumen
- Filter: Alle, Ausstehend, Warte auf Karte, Belastet, Fehlgeschlagen, Storniert
- Suche nach Name oder Buchungs-ID
- Detail-Modal mit Bearbeitungsmöglichkeit (Betrag, Datum)
- Aktionen: Belasten, Stornieren, Erstatten
- Auto-Refresh alle 30 Sekunden

### Buchungsstatus

| Status | Beschreibung | Nächster Schritt |
|---|---|---|
| `pending_tokenization` | Buchung erstellt, Gast hat CC noch nicht eingegeben | Warte auf Gast / CC-Link erneut senden |
| `pending` | Token vorhanden, wartet auf Belastung | Manuell belasten oder Cron wartet auf `charge_date` |
| `charged` | Erfolgreich belastet | Erstatten möglich |
| `failed` | Belastung fehlgeschlagen | Erneut versuchen oder stornieren |
| `cancelled` | Manuell storniert | Endstatus |
| `expired` | 7 Tage nach Abreise nicht belastet (Auto-Cleanup) | Endstatus |
| `refunded` | Erstattung abgeschlossen | Endstatus |
| `refund_pending` | Erstattung eingeleitet | Warte auf Adyen |
| `tokenization_failed` | Karten-Autorisierung fehlgeschlagen | Gast kontaktieren |

### 7.3 MOTO-Tool (moto.html)

Rezeptionstool für telefonische Kreditkartenaufnahme und CC-Link-Versand. Drei Optionen:

1. **⚡ CC aufnehmen & sofort belasten** – MOTO-Tokenisierung via Adyen Drop-in → sofortige Belastung nach Tokenisierung. Ideal für direkte Zahlungen.

2. **📅 CC aufnehmen & später belasten** – MOTO-Tokenisierung → Karte wird am gewählten Datum automatisch belastet (Cron-Job). Ideal für vCC (virtuelle Kreditkarten) die erst am Anreisetag belastbar sind. Datumswähler "CC belasten am" (Default: Anreise).

3. **📧 CC-Link per E-Mail** – Buchung wird erstellt, Gast erhält pay.html-Link per E-Mail (via brevo-proxy `/send-guest`). Gast gibt CC-Daten selbst ein.

**Formularfelder:** Gastname, E-Mail, Anreise, Abreise, Betrag (EUR), Zimmer, Firma, Stornobedingungen

---

## 8. Cron-Job (Automatische Belastungen)

Der Payment-Worker enthält einen Cron-Trigger der automatisch fällige Zahlungen belastet und abgelaufene Buchungen aufräumt.

### Step 1: Fällige Zahlungen belasten

Alle Buchungen mit Status `pending`, vorhandenem Token und `charge_date <= heute` werden automatisch per MIT (Merchant-Initiated Transaction) belastet.

### Step 2: Auto-Expire

Buchungen mit Status `pending`, `pending_tokenization` oder `failed` die **7 Tage nach Abreise** (`checkout_date`) noch offen sind, werden automatisch auf `expired` gesetzt.

### Konfiguration

Der Cron wird in der `wrangler.toml` konfiguriert. Empfohlen: Tägliche Ausführung um 06:00 UTC.

---

## 9. E-Mail-Konfiguration

### DNS-Einträge (hotelwestend.de bei e-ventis)

| Eintrag | Wert |
|---|---|
| **SPF** | `v=spf1 mx a ip4:212.114.252.52 ip4:138.201.127.42 include:spf.protection.outlook.com include:sendinblue.com ~all` |
| **DKIM brevo1** | CNAME → `b1.hotelwestend-de.dkim.brevo.com` |
| **DKIM brevo2** | CNAME → `b2.hotelwestend-de.dkim.brevo.com` |
| **DMARC** | `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com` |
| **Brevo-Code** | `brevo-code:1306ddbe7095decbced2958e034a88a4` |
| **DKIM-Status** | ⚠️ PENDING – Webhoster (Sebastian Tanzer, e-ventis) muss TXT→CNAME ändern |

### E-Mail-Templates

- **Angebots-E-Mail** (gold Banner) – generiert aus index.html
- **Buchungsbestätigungs-E-Mail** (grün Banner) – generiert aus index.html
- **Angebotsannahme an Hotel** – generiert aus confirm.html (über brevo-proxy `/`)
- **CC-Link an Gast** – generiert aus moto.html (über brevo-proxy `/send-guest`)

---

## 10. Branding & Styling

| Element | Wert |
|---|---|
| **Schrift Body** | DM Sans (300/400/500/600) |
| **Schrift Hotel** | Playfair Display (400/600/700) |
| **Primärfarbe (Navy/Dark)** | `#3B4547` (Pantone 433) |
| **Akzent (Gold)** | `#C9983A` |
| **Akzent (Petrol)** | `#2A6B7C` |
| **Hintergrund (Cream)** | `#F5F3EF` / `#FAF8F4` |
| **Bestätigung (Grün)** | `#16A34A` / `#2D6B4A` |
| **Logo** | `wh-logo_weiss_transparent.png` (weißer Schriftzug, transparent) |

---

## 11. Zugänge & Accounts

### Dienste

| Dienst | URL | Account / Anmerkung |
|---|---|---|
| Cloudflare Dashboard | `dash.cloudflare.com` | `dd@hotelwestend.de` |
| Cloudflare Zero Trust | `one.dash.cloudflare.com` | `dd@hotelwestend.de` |
| GitHub Repository | `github.com/duemler90431/westend-tool` | `duemler90431` |
| Brevo (E-Mail) | `app.brevo.com` | API-Key als Worker Secret |
| Adyen Customer Area | `ca-test.adyen.com` / `ca-live.adyen.com` | Bestehendes Hotel-Konto (seit ~4 Jahren) |
| INWX (DNS) | `inwx.de` | `booking-hotelwestend.de` + `booking-westendhotel.de` |
| e-ventis (Webhoster) | – | Sebastian Tanzer (`hotelwestend.de` DNS/DKIM) |

### Cloudflare Worker Secrets

| Worker | Secret | Beschreibung |
|---|---|---|
| `westend-brevo-proxy` | `BREVO_API_KEY` | Brevo API-Key für E-Mail-Versand |
| `westend-payment-worker` | `ADYEN_API_KEY` | Adyen API Key (aktuell: TEST) |
| `westend-payment-worker` | `ADYEN_MERCHANT_ACCOUNT` | Adyen Merchant Account Name |
| `westend-payment-worker` | `ADYEN_CLIENT_KEY` | Adyen Client Key für Drop-in |
| `westend-payment-worker` | `ADYEN_HMAC_KEY` | Für Webhook-Verifizierung |

---

## 12. Adyen Live-Umstellung (TODO)

Aktuell läuft das Payment-System in der Adyen **TEST-Umgebung**. Für die Live-Umstellung:

### 1. Neuen API Credential im Live Customer Area erstellen
- API Key + Client Key generieren
- `booking-hotelwestend.de` als Allowed Origin im Client Key hinzufügen

### 2. Code-Änderungen (3 Dateien)
- `pay.html` + `moto.html`: Adyen SDK-URL von `checkoutshopper-test` auf `checkoutshopper-live`
- `westend-payment-worker.js`: API-URLs von `checkout-test.adyen.com` / `pal-test.adyen.com` auf Live-Endpoints

### 3. Worker Secrets auf Live-Keys umstellen
- `ADYEN_API_KEY`, `ADYEN_CLIENT_KEY` im Cloudflare Dashboard ersetzen

### 4. Webhook im Live Customer Area einrichten
- Standard Notification auf `westend-payment-worker.dd-f19.workers.dev/webhook`
- HMAC Key konfigurieren

### 5. End-to-End Test mit echten Karten
- Kleine Beträge: Tokenisierung, Belastung, Refund testen

---

## 13. Datenfluss

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

## 14. Offene Punkte

- **Adyen Live-Umstellung** – Siehe Kapitel 12
- **Angebotstool → D1** – Angebote zusätzlich in D1 speichern für Nachverfolgung
- **Auto-Belastung aus Angebotstool** – Bei Bestätigung mit CC-Toggle automatisch Payment-Buchung in D1 erstellen
- **DKIM-Status** – Webhoster muss DKIM-Einträge von TXT auf CNAME ändern (e-ventis / Sebastian Tanzer)
- **Dashboard: Status „expired"** – CSS-Styling und Filter-Button für expired-Status im payment-dashboard.html ergänzen
- **Weitere Mitarbeiter-E-Mails** – In der Hotelteam-Policy bei Cloudflare Access ergänzen

---

## 15. Änderungshistorie

| Datum | Änderung |
|---|---|
| 15.03.2026 | Cloudflare Access eingerichtet (OTP, Bypass für confirm+pay) |
| 15.03.2026 | confirm.html: Alle URLs auf booking-hotelwestend.de umgestellt |
| 15.03.2026 | Payment-Worker: returnUrl auf booking-hotelwestend.de |
| 15.03.2026 | moto.html: MOTO-Tool mit 3 Optionen (sofort/später/E-Mail) |
| 15.03.2026 | brevo-proxy: /send-guest Route für CC-Link-Versand an Gäste |
| 15.03.2026 | portal.html: Rezeption-Startseite |
| 15.03.2026 | Payment-Worker: Auto-Expire nach 7 Tagen nach Abreise |
| 14.03.2026 | Payment-Worker v2.0.0 mit D1, Cron, Dashboard, MOTO |
| 14.03.2026 | pay.html: Gast-Zahlungsseite mit Adyen Drop-in |
| 14.03.2026 | CF Pages: booking-hotelwestend.de + Redirect booking-westendhotel.de |
| 14.03.2026 | CORS brevo-proxy aktualisiert |
| 09.03.2026 | Cloudflare Worker als E-Mail-Proxy (Brevo API-Key serverseitig) |
| 09.03.2026 | Buchungsbestätigung-Button mit Prefill in Angebotsannahme-E-Mail |
| 09.03.2026 | Freibleibend-Option bei Angebotsgültigkeit |
| 04.03.2026 | Gastname-Feld pro Zimmerzeile (Besteller/Gast-Logik) |
| 03.03.2026 | Base64-URL-Kodierung für Confirm-Link |
| 03.03.2026 | DNS/DKIM/SPF/DMARC bei e-ventis eingerichtet |

---

## 16. Bekannte Einschränkungen

- **Cloudflare Pages Pretty URLs:** `.html`-Extension wird automatisch entfernt (`/confirm.html` → `/confirm`). Daher müssen Bypass-Policies in CF Access beide Pfade abdecken.
- **Brevo Link-Tracking:** Kann URL-Parameter verfälschen. Gelöst durch Base64-Kodierung als einzelner `d`-Parameter.
- **GitHub Secret Scanning:** API-Keys dürfen nie in den Code committed werden – GitHub erkennt Brevo/Sendinblue-Keys und Brevo deaktiviert sie sofort.
- **Cloudflare Worker Free-Tier:** 100.000 Requests/Tag, mehr als ausreichend für den Hotelbetrieb.
- **Adyen MOTO:** Kein 3D Secure – Rezeption muss CC-Daten korrekt eingeben. Allowed Origin in Adyen muss `booking-hotelwestend.de` enthalten.
