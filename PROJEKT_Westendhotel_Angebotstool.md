# Westendhotel Nürnberg – Projektdokumentation

**Stand:** 18. März 2026
**Betreiber:** MORE Hospitality GmbH (HRB 44922), Geschäftsführer Daniel Dümler
**Hotel:** westendhotel Nürnberg, Karl-Martell-Str. 42–44, 90431 Nürnberg (~28 Zimmer, ~8 Mitarbeiter)

---

## 1. URLs & Zugänge

### 1.1 Live-System

| Dienst | URL |
|---|---|
| **Frontend (CF Pages)** | https://booking-hotelwestend.de |
| **Angebotstool** | https://booking-hotelwestend.de/index.html |
| **MOTO-Tool** | https://booking-hotelwestend.de/moto.html (oder /moto) |
| **Payment Dashboard** | https://booking-hotelwestend.de/payment-dashboard.html |
| **Portal** | https://booking-hotelwestend.de/portal.html |
| **Gast-Bestätigungsseite** | https://booking-hotelwestend.de/confirm.html |
| **Gast-Zahlungsseite** | https://booking-hotelwestend.de/pay.html |
| **Payment Worker** | https://westend-payment-worker.dd-f19.workers.dev |
| **Brevo Proxy Worker** | https://westend-brevo-proxy.dd-f19.workers.dev |
| **Redirect-Domain** | https://booking-westendhotel.de → 301 → booking-hotelwestend.de |

### 1.2 Staging-System

| Dienst | URL |
|---|---|
| **Staging Worker** | https://westend-payment-worker-staging.dd-f19.workers.dev |
| **Staging D1** | `westend-bookings-staging` |
| **Lokaler Test** | `python3 -m http.server 8080` in `~/westend-tool-staging` |
| **Adyen Test SDK** | `https://checkoutshopper-test.adyen.com/checkoutshopper/sdk/5.65.0` |

### 1.3 Externe Dienste & Accounts

| Dienst | Zugang / Details |
|---|---|
| **GitHub** | https://github.com/duemler90431/westend-tool |
| **Cloudflare** | dd@hotelwestend.de · Account-ID: `f1954d7ca7919a36fcb693a025bf...` · Subdomain: `dd-f19.workers.dev` |
| **Adyen** | Live Merchant: `HotelWestendNuernbergECOM` · Prefix: `55f5f21b555bf6d7-HotelWestendNuernberg` |
| **Brevo** | Transaktionale E-Mails · Absender: `info@hotelwestend.de` / `westendhotel nürnberg` |
| **INWX** | Domain-Registrar für `booking-hotelwestend.de` + `booking-westendhotel.de` (NS → Cloudflare) |
| **e-ventis** | Webhoster für `hotelwestend.de` (WordPress, DKIM-Setup via Sebastian Tanzer) |
| **Microsoft 365** | Tenant: `westendhotelnuernb.onmicrosoft.com` · Business Standard (dd@) + Exchange Online Plan 1 (info@) |
| **Ibelsa Rooms** | PMS (Property Management System) |
| **HotelNetSolutions** | Channel Manager (inkl. HRS/KDS) |
| **RoomPriceGenie** | Yield Management |

---

## 2. Architektur

### 2.1 Übersicht

```
GitHub (duemler90431/westend-tool)
  └─ main branch → Cloudflare Pages auto-deploy → booking-hotelwestend.de
  └─ staging branch → NICHT auto-deployed (CF non-production builds deaktiviert)
                    → Lokaler Test via python3 http.server

Frontend-Seiten (statisches HTML/JS):
  index.html ── Angebotstool (Angebote + Bestätigungen)
  moto.html ─── MOTO-Kreditkarte (3 Modi: sofort, später, CC-Link)
  pay.html ──── Gast-facing Zahlungsseite (Tokenisierung)
  confirm.html ─ Gast-Bestätigungsseite (Angebot annehmen)
  payment-dashboard.html ── Dashboard (Tabelle + Tagesansicht)
  portal.html ─ Einstiegsportal (3 Karten)
  config.js ─── Einzige Datei die sich zwischen Live/Staging unterscheidet

Backend:
  westend-payment-worker.js ── CF Worker (Adyen API, D1, Cron)
  westend-brevo-proxy.js ───── CF Worker (Brevo E-Mail Proxy)

Datenbank:
  D1 "westend-bookings" ────── Live
  D1 "westend-bookings-staging" ── Staging
```

### 2.2 Cloudflare Workers & Bindings

**westend-payment-worker** (v2.2.0)
- D1 Binding: `DB` → `westend-bookings`
- Secrets: `ADYEN_API_KEY`, `ADYEN_MERCHANT_ACCOUNT`, `ADYEN_CLIENT_KEY`, `ADYEN_HMAC_KEY`, `BREVO_API_KEY`
- Cron Trigger: täglich (fällige Belastungen + Auto-Erinnerungsmails)
- Deploy: manuell via CF Dashboard → Edit Code

**westend-payment-worker-staging**
- D1 Binding: `DB` → `westend-bookings-staging`
- Secrets: Adyen TEST-Credentials, `BREVO_API_KEY`
- Adyen-URL: `checkout-test.adyen.com`, environment: `test`

**westend-brevo-proxy**
- Route: `/send-guest` (E-Mail-Versand für confirm.html)
- CORS Allowed Origins: `booking-hotelwestend.de`, `duemler90431.github.io`, `localhost:8080`

### 2.3 Cloudflare Pages

- **Project:** `westend-tool`
- **Custom Domain:** `booking-hotelwestend.de`
- **GitHub Repo:** `duemler90431/westend-tool` (Auto-Deploy bei Push auf `main`)
- **Non-production branch builds:** deaktiviert

### 2.4 Cloudflare Zero Trust Access

- **Team:** `westend-tool`
- **Login:** OTP per E-Mail (dd@ und info@hotelwestend.de)
- **Bypass-Policies:** `/confirm` und `/pay` Pfade sind öffentlich (Gast-Zugang)

### 2.5 config.js (Live vs. Staging)

**Live (main):**
```javascript
const CONFIG = {
  env: 'live',
  workerURL: 'https://westend-payment-worker.dd-f19.workers.dev',
  brevoProxyURL: 'https://westend-brevo-proxy.dd-f19.workers.dev',
  adyenEnv: 'live',
  adyenSDK: 'https://checkoutshopper-live.adyen.com/checkoutshopper/sdk/5.65.0',
  payBaseURL: 'https://booking-hotelwestend.de/pay.html',
};
```

**Staging (staging branch):**
```javascript
const CONFIG = {
  env: 'test',
  workerURL: 'https://westend-payment-worker-staging.dd-f19.workers.dev',
  brevoProxyURL: 'https://westend-brevo-proxy.dd-f19.workers.dev',
  adyenEnv: 'test',
  adyenSDK: 'https://checkoutshopper-test.adyen.com/checkoutshopper/sdk/5.65.0',
  payBaseURL: 'https://booking-hotelwestend.de/pay.html',
};
```

---

## 3. D1 Datenbank-Schema (v2.1)

```sql
CREATE TABLE bookings (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id         TEXT UNIQUE NOT NULL,      -- z.B. WH-2026-A1B2C3
  guest_name         TEXT NOT NULL,
  guest_email        TEXT DEFAULT '',
  guest_firma        TEXT DEFAULT '',
  guest_telefon      TEXT DEFAULT '',
  checkin_date       TEXT,                       -- ISO: 2026-03-18
  checkout_date      TEXT,
  zimmer             TEXT DEFAULT '',            -- z.B. "1x MORE ROOM"
  gesamt_betrag      REAL DEFAULT 0,             -- EUR (Dezimal)
  amount             INTEGER DEFAULT 0,          -- Cent für Adyen
  currency           TEXT DEFAULT 'EUR',
  charge_date        TEXT,                       -- Belastungsdatum
  status             TEXT DEFAULT 'pending_tokenization',
  source             TEXT DEFAULT 'ecommerce',   -- ecommerce | moto | angebotstool
  shopper_reference  TEXT,
  adyen_token        TEXT,                       -- Gespeichertes Zahlungsmittel
  adyen_session_id   TEXT,
  psp_reference      TEXT,                       -- Adyen PSP nach Belastung
  last_error         TEXT,
  rate_type          TEXT DEFAULT 'regulaer',
  storno_typ         TEXT DEFAULT 'regulaer',    -- regulaer | messe | gruppe | nonclx
  r_name             TEXT DEFAULT '',            -- Rechnungsadresse
  r_strasse          TEXT DEFAULT '',
  r_plzort           TEXT DEFAULT '',
  r_zusatz           TEXT DEFAULT '',
  angebot_id         TEXT,
  angebot_status     TEXT,                       -- offer_sent | confirmed
  created_at         TEXT DEFAULT (datetime('now')),
  updated_at         TEXT,
  charged_at         TEXT,
  cancelled_at       TEXT,
  refunded_at        TEXT,
  refund_amount      INTEGER,
  reminder_sent_at   TEXT                        -- v2.2: Erinnerungsmail-Tracking
);

-- Indizes
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_charge_date ON bookings(charge_date);
CREATE INDEX idx_bookings_checkin ON bookings(checkin_date);
```

### Status-Lifecycle

```
offer_sent → confirmed → pending_tokenization → pending → charged
                                                        → failed → (retry)
                       → pending_tokenization → tokenization_failed → (remind)
                                              → expired (7d nach checkout)
                       → cancelled
charged → refund_pending → refunded
```

---

## 4. API-Endpoints (Payment Worker)

| Method | Endpoint | Beschreibung |
|---|---|---|
| `GET` | `/` | Health Check (Version, Environment) |
| `POST` | `/session` | Adyen Checkout Session erstellen (Zero-Auth) |
| `POST` | `/charge` | MIT-Belastung mit Token |
| `POST` | `/webhook` | Adyen Webhook (Token-Speicherung, Refund-Bestätigung) |
| `GET` | `/bookings` | Alle Buchungen abrufen |
| `GET` | `/bookings/:id` | Einzelne Buchung |
| `PUT` | `/bookings/:id` | Buchung aktualisieren (Betrag, Datum) |
| `DELETE` | `/bookings/:id` | Buchung stornieren |
| `POST` | `/bookings/:id/refund` | Erstattung via Adyen |
| `POST` | `/bookings/:id/remind` | Erinnerungsmail senden |
| `POST` | `/bookings/from-offer` | Buchung aus Angebotstool erstellen |

---

## 5. Tool-Seiten im Detail

### 5.1 index.html – Angebotstool

Erstellt Angebote und Bestätigungen. Sendet E-Mails über Brevo. Bei Bestätigung mit CC-Toggle wird automatisch eine Buchung in D1 erstellt (`POST /bookings/from-offer`) und der Gast erhält einen Link zu `pay.html`.

Zimmerkategorien: Basic Room (~12–14m²), MORE Room (~20–30m²), Studio mit Kitchenette.
Stornobedingungen: Regulär (48h), Messe (42 Tage), Gruppe (14 Tage), NON-CLX.
Sprachen: DE / EN.

### 5.2 moto.html – MOTO-Kreditkarte

Drei Modi:
1. **CC aufnehmen & sofort belasten** — Tokenisierung + sofortige Belastung (Retry-Polling 5×2s)
2. **CC aufnehmen & später belasten** — Tokenisierung, Belastung per Cron am chargeDate
3. **CC-Link per E-Mail** — Buchung erstellt, Gast bekommt Link zu pay.html

SDK-Loading: `document.write()` mit URL aus `config.js` (synchrones Laden).

### 5.3 pay.html – Gast-Zahlungsseite

Öffentlich zugänglich (Cloudflare Access Bypass). Adyen Drop-in für Kreditkarten-Tokenisierung. SDK hardcoded auf Live-URL. URL-Parameter: `id`, `name`, `email`, `checkin`, `checkout`, `room`, `amount`, `lang`.

### 5.4 payment-dashboard.html – Dashboard (v2)

Features:
- **Stats-Bar:** Gesamt, Ausstehend, Belastet, Fehlgeschlagen, Volumen
- **Status-Filter:** Alle, Ausstehend, Warte auf Karte, Belastet, Fehlgeschlagen, Storniert, Abgelaufen
- **Erweiterte Suche:** Name, ID, E-Mail, Firma, Zimmer, Betrag, Datum (DD.MM.YYYY + ISO), Status-Label, Source
- **View-Toggle:** Tabelle ↔ Tagesansicht
- **Tagesansicht:** Datum-Picker mit ‹/›/Heute, 4 Sektionen (Anreisen, Abreisen, Fällige Belastungen, Ausstehende CC — letztere nur bei Heute-Ansicht), kollabierbar
- **Detail-Modal:** Alle Buchungsfelder inkl. Firma, Telefon, Check-in/out, Zimmer. Inline-Editing (Betrag, Datum) für pending/failed.
- **Aktionen:** Belasten, Erinnern, Stornieren, Erstatten
- **Auto-Refresh:** alle 30 Sekunden

### 5.5 confirm.html – Gast-Bestätigungsseite

Öffentlich. Gast klickt "Buchung bestätigen" → Hotel bekommt Notification-E-Mail mit vorausgefülltem Link zurück ins Angebotstool.

### 5.6 portal.html – Einstiegsportal

3 Karten auf Pantone 433 Hintergrund: Angebotstool, MOTO, Dashboard. Alle Seiten haben eine gemeinsame site-nav Leiste.

---

## 6. E-Mail-Design

**Helles Design (seit 17.03.2026):** #EEECEA Background, weiße Cards mit border #E0DDD6, Pantone 433 (#3B4547) Header/Footer, Petrol (#2A6B7C) Akzente. Table-basiert für Outlook-Kompatibilität. DM Sans (Frontend) / Arial (E-Mail Fallback).

**Zimmerbilder in E-Mails:** BASIC 75%, MORE 66%, Studio 55% Breite (je 1 Bild pro Kategorie).

**Branding-Regel:** Kein Gold (#C9983A / #C5A55A) in UI-Elementen — nur Pantone 433 und Petrol.

**Erinnerungsmails (v2.2):** Unterschiedlicher Text für `pending_tokenization` vs. `tokenization_failed`. Automatischer Cron (24h nach Erstellung, nicht wenn Anreise heute) + manueller Remind-Button im Dashboard.

---

## 7. Deployment-Workflow

### Frontend (HTML/CSS/JS)

```
GitHub (staging branch) bearbeiten
  → Lokal testen: cd ~/westend-tool-staging && git pull && python3 -m http.server 8080
  → OK? → Gleiche Änderungen in main branch übernehmen
  → Push auf main → Cloudflare Pages auto-deploy → Live
```

### Worker (JS)

```
Cloudflare Dashboard → Workers & Pages → westend-payment-worker
  → "Edit Code" → Code ersetzen → Deploy
```

### D1 (SQL)

```
Cloudflare Dashboard → Storage & databases → D1 → westend-bookings → Console
  → SQL eingeben → Execute
Oder: wrangler d1 execute westend-bookings --remote --command="..."
```

---

## 8. Bekannte Pitfalls

| Problem | Lösung |
|---|---|
| Adyen Live-URL braucht VOLLEN Prefix | `55f5f21b555bf6d7-HotelWestendNuernberg-checkout-live.adyenpayments.com` (sonst CF Error 11012) |
| CF Email Obfuscation | HTML-Entities verwenden (`&#64;` statt `@`) |
| CF Worker-zu-Worker fetch | Error 1042 → Brevo API direkt statt über Proxy-Worker |
| Adyen Drop-in lädt nicht | SDK muss via `document.write()` synchron geladen werden (nicht `createElement`) |
| Adyen Staging | `environment: 'test'` in config.js + Test-SDK-URL |
| pay.html Truncation | Immer `init()` + closing tags prüfen |
| CORS beim lokalen Testen | `localhost:8080` ist als Allowed Origin konfiguriert |
| Brevo Link-Rewriting | Proxy-Worker nutzen, nicht direkte API |

---

## 9. Nächste Projekte / Roadmap

### Mini-PMS / Belegungsplan (geplant, 2–3 Sessions)

Eigener Zimmerbelegungsplan als Vorstufe eines Mini-PMS. Erfordert vorher:
- Datenmodell-Konzept (Zimmerinventar-Tabelle, konkrete Zimmernummern statt Kategorien)
- Gantt-artiger Kalender (Zimmer = Zeilen, Tage = Spalten)
- Drag & Drop, Kollisionserkennung
- Separate Planungs-Session(s) bevor mit der Umsetzung begonnen wird

### Sonstige offene Punkte

- Optional: confirm.html Notification-E-Mail auf helles Design umstellen
- Angebotstool Refactoring (JS-Farbvariablen, Code-Struktur)
- M365: Alte ALSO-Lizenzen nach 28.03.2026 prüfen, Partner-Beziehungen entfernen
- Power Automate: Keyword-Optimierung für Inquiry-Detection
- TiMaS Zeiterfassung: Evaluation / DATEV-Export
- Mews PMS: Evaluierung vs. Ibelsa (HRS-Integration als Blocker)
- Netzwerk: Versatel Glasfaser-Migration mit UDM-Pro Dual-WAN

---

## 10. Systemlandschaft (Bestand)

| System | Funktion |
|---|---|
| **Ibelsa Rooms** | PMS (Property Management System) |
| **HotelNetSolutions (HNS)** | Channel Manager (inkl. HRS/KDS) |
| **Straiv** | Digitale Guest Journey (Check-in, in Praxis unzuverlässig) |
| **RoomPriceGenie** | Yield Management |
| **SALTO** | Schließsystem (intern 192.168.0.130, Ports 8097/8098/5010/8100) |
| **Microsoft 365** | E-Mail, Office, Power Automate |
| **DATEV** | Lohnabrechnung via Steuerberater Röhrer |
| **DKB** | Banking |
| **Brevo** | Transaktionale E-Mails (Free Plan: 300/Tag) |
| **Adyen** | Payment-Processing (Live + Test) |

---

*Letzte Aktualisierung: 18. März 2026*
