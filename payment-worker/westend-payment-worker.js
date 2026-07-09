/**
 /**
 * westend-payment-worker v2.5.0
 * Cloudflare Worker für tokenisierte Kreditkartenzahlungen
 * westendhotel Nürnberg – MORE Hospitality GmbH
 *
 * ⚠️ LIVE-VERSION
 *
 * BACKEND: Cloudflare D1 (SQL)
 *
 * CHANGELOG v2.5.0 (08.07.2026) – Zweck-Trennung, Reminder-Staffel, Security, westendOS-Integration:
 *   - FIX (Bug): Garantiekarten wurden vom Cron am Check-in automatisch belastet.
 *     Ursache: charge_date wurde still auf Check-in gesetzt + Cron belastete jede
 *     'pending'-Buchung mit Token. NEU: purpose ('charge_scheduled' | 'guarantee');
 *     Cron belastet NUR purpose='charge_scheduled' mit explizitem charge_date.
 *     charge_date hat keinen stillen Default mehr (guarantee ⇒ charge_date=null).
 *   - NEU: Reminder-Staffel — max 2 Gast-Mails (R1 ~3 Tage, R2 5–7 Tage vor
 *     charge_date/check_in), reminder_count/-last_stage; manuelle Reminder zählen
 *     mit + Warnung ab 2; danach nur interner Dashboard-Hinweis.
 *   - SECURITY: Adyen-Webhook HMAC-Verifizierung (SHA-256), zweistufig via
 *     HMAC_MODE ('log' → 'enforce'). Vorher war der Webhook unsigniert akzeptiert.
 *   - NEU (Integration): zweiter Auth-Weg authenticateCaller() für Server-Calls
 *     aus westendOS (X-API-Key gegen dediziertes Secret PAYMENT_WORKER_API_KEY);
 *     reservation_id an bookings (von westendOS gesetzt, bei westend-tool null).
 *     Worker bleibt gemeinsame Zahlungs-Engine für westend-tool UND westendOS.
 *   - Secrets NEU: PAYMENT_WORKER_API_KEY, ADYEN_HMAC_KEY; Env: HMAC_MODE.
 *
 * CHANGELOG v2.4.0 (18.04.2026) – email_log-Integration (Phase 2 CRM):
 *   - NEU: Service Binding PMS → westend-pms-worker für email_log-Calls
 *   - NEU: Reminder-Mails werden jetzt zentral in PMS.email_log protokolliert
 *     • Nach jedem erfolgreichen Brevo-Send → POST PMS /api/email-log
 *     • Fire-and-forget: PMS-down blockiert Mailversand NICHT
 *     • brevo_message_id wird für Webhook-Matching extrahiert
 *   - NEU: sendReminderViaBrevo() liefert jetzt zusätzlich messageId zurück
 *   - CHANGE: Brevo-Response wird jetzt als JSON geparst (vorher nur text)
 *
 * CHANGELOG v2.3.0 (15.04.2026) – PMS-Integration / Adyen Charging:
 *   - NEU: POST /charge-amount → MIT-Belastung mit beliebigem Betrag (für PMS)
 *     • Erlaubt Final-Belastung inkl. Zusatzleistungen (Frühstück, Minibar, etc.)
 *     • Schreibt charge_log-Einträge (separate Tabelle, GoBD-konform)
 *   - NEU: POST /payment-link → Adyen Payment Link erstellen (PayByLink)
 *     • Für Rechnungs-/Mahn-Emails wenn kein Token vorhanden
 *     • Adyen-gehostete Zahlseite (PCI SAQ A)
 *   - NEU: GET /booking-token/:bookingId → Token-Status für PMS-Lookup
 *     • Live-Lookup-Architektur: PMS speichert Token NICHT lokal
 *     • Liefert: hasToken, cardSummary, cardExpiry, status
 *   - NEU: Webhook-Erweiterung für PAYMENT_RECEIVED (PayByLink-Zahlungen)
 *   - NEU: API-Key-Auth für PMS-Endpoints (X-PMS-API-Key Header)
 *   - NEU: D1-Tabellen charge_log + payment_links
 *
 * CHANGELOG v2.2.1 (09.04.2026):
 *   - Adyen Drop-in auf Kreditkarten beschränkt (allowedPaymentMethods: ["scheme"])
 *
 * Endpoints:
 *   POST /session                    → Adyen Checkout Session (Zero-Auth)
 *   POST /charge                     → MIT-Belastung (gespeicherter Betrag)
 *   POST /charge-amount              → MIT-Belastung (beliebiger Betrag) [PMS, AUTH]
 *   POST /payment-link               → Adyen Payment Link erstellen [PMS, AUTH]
 *   GET  /booking-token/:id          → Token-Status für PMS [PMS, AUTH]
 *   POST /webhook                    → Adyen Webhook-Notifications
 *   GET  /bookings                   → Alle Buchungen
 *   GET  /bookings/:id               → Einzelne Buchung
 *   PUT  /bookings/:id               → Buchung aktualisieren
 *   DELETE /bookings/:id             → Buchung stornieren
 *   POST /bookings/:id/refund        → Rückerstattung
 *   POST /bookings/:id/remind        → Erinnerungsmail
 *   POST /bookings/from-offer        → Buchung aus Angebotstool
 *
 * Environment Variables (Secrets):
 *   ADYEN_API_KEY, ADYEN_MERCHANT_ACCOUNT, ADYEN_CLIENT_KEY
 *   ADYEN_HMAC_KEY (Webhook-Verifizierung)
 *   BREVO_API_KEY (Erinnerungsmails)
 *   PMS_API_KEY (PMS→Payment-Worker Auth, NEU v2.3)
 *
 * D1 Database Binding:
 *   DB → D1 Database "westend-bookings"
 *
 * Service Bindings (NEU v2.4):
 *   PMS → Service "westend-pms-worker" (für email_log-Calls)
 *   Dashboard-Setup: Workers → westend-payment-worker →
 *                    Settings → Bindings → Service Bindings → Add:
 *                    Variable name: PMS
 *                    Service: westend-pms-worker
 *
 * Required D1 Migration (v2.3.0):
 *   CREATE TABLE IF NOT EXISTS charge_log (
 *     id INTEGER PRIMARY KEY AUTOINCREMENT,
 *     booking_id TEXT NOT NULL,
 *     amount INTEGER NOT NULL,
 *     currency TEXT NOT NULL,
 *     reference TEXT NOT NULL,
 *     psp_reference TEXT,
 *     result_code TEXT,
 *     refusal_reason TEXT,
 *     charged_by TEXT,
 *     created_at TEXT DEFAULT (datetime('now'))
 *   );
 *   CREATE INDEX IF NOT EXISTS idx_charge_log_booking ON charge_log(booking_id);
 *
 *   CREATE TABLE IF NOT EXISTS payment_links (
 *     id INTEGER PRIMARY KEY AUTOINCREMENT,
 *     booking_id TEXT NOT NULL,
 *     adyen_link_id TEXT NOT NULL UNIQUE,
 *     reference TEXT NOT NULL,
 *     amount INTEGER NOT NULL,
 *     currency TEXT NOT NULL,
 *     url TEXT NOT NULL,
 *     status TEXT DEFAULT 'active',
 *     expires_at TEXT,
 *     paid_at TEXT,
 *     psp_reference TEXT,
 *     created_at TEXT DEFAULT (datetime('now'))
 *   );
 *   CREATE INDEX IF NOT EXISTS idx_payment_links_booking ON payment_links(booking_id);
 *   CREATE INDEX IF NOT EXISTS idx_payment_links_ref ON payment_links(reference);
 */

// ── Config ─────────────────────────────────────────────
// Adyen Checkout-Base. LIVE-Default = Merchant-Prefix-Endpoint. Override via
// [vars] ADYEN_BASE_URL (env). Live-toml setzt exakt diese URL (Selbstdoku);
// Staging setzt die TEST-URL "https://checkout-test.adyen.com/v71" — ACHTUNG:
// TEST hat KEINEN Merchant-Prefix und KEIN /checkout-Segment (vgl. CF-Error-11012-
// Lesson: falscher Host/Prefix → 11012). env.ADYEN_BASE_URL gewinnt, sonst Fallback.
const ADYEN_BASE_URL_DEFAULT = "https://55f5f21b555bf6d7-HotelWestendNuernberg-checkout-live.adyenpayments.com/checkout/v71";
function adyenBase(env) {
  return (env && env.ADYEN_BASE_URL) || ADYEN_BASE_URL_DEFAULT;
}
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key, X-PMS-API-Key",
};

// ── v2.5.0: CORS-Origin einschränken ──────────────────────────────────
// Dashboard/MOTO laufen künftig same-origin über den /api-Proxy (kein CORS).
// Cross-origin im Browser ist NUR noch der Gast-Pfad pay.html → /session.
// Statt "*" wird die anfragende Origin nur reflektiert, wenn sie in der
// Allowlist steht (env.ALLOWED_ORIGINS, komma-separiert; Default = Gast-Domain).
// Server-zu-Server-Calls haben keine Origin → unberührt.
function resolveCorsOrigin(request, env) {
  const configured = (env.ALLOWED_ORIGINS || "https://booking-hotelwestend.de")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const origin = request.headers.get("Origin");
  if (origin && configured.includes(origin)) return origin;
  return configured[0]; // Fallback: erste erlaubte Origin (bewusst NICHT "*")
}

// ── v2.5.0: Adyen-Webhook HMAC-Verifizierung ──────────────────────────
// Sicherheit: verhindert, dass Dritte gefälschte Notifications einspielen
// (z.B. Buchung auf 'charged' setzen). Adyen signiert jeden NotificationRequestItem
// per HMAC-SHA256; Signatur liegt in additionalData.hmacSignature.
// Signier-String = ausgewählte Felder, ':'-getrennt, mit \-Escaping.
function _hmacHexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}
function _hmacEscape(v) {
  return String(v == null ? "" : v).replace(/\\/g, "\\\\").replace(/:/g, "\\:");
}
async function verifyAdyenHmac(notificationItem, hmacKeyHex) {
  const ad = notificationItem.additionalData || {};
  const providedSig = ad.hmacSignature;
  if (!providedSig || !hmacKeyHex) return false;
  const amount = notificationItem.amount || {};
  // Adyen-Feldreihenfolge (fix):
  const dataToSign = [
    notificationItem.pspReference,
    notificationItem.originalReference,
    notificationItem.merchantAccountCode,
    notificationItem.merchantReference,
    amount.value,
    amount.currency,
    notificationItem.eventCode,
    notificationItem.success,
  ].map(_hmacEscape).join(":");
  try {
    const key = await crypto.subtle.importKey(
      "raw", _hmacHexToBytes(hmacKeyHex),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(dataToSign));
    const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
    // Längen-Check + konstantzeitiger Vergleich
    if (expected.length !== providedSig.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ providedSig.charCodeAt(i);
    return diff === 0;
  } catch (e) {
    console.error("HMAC-Verify-Fehler:", e.message);
    return false;
  }
}

// ── v2.5.0: Zweiter Auth-Weg (Server-zu-Server aus westendOS) ──────────
// Bestehendes westend-tool-Zugriffsmodell (Browser, offen) bleibt unberührt;
// zusätzlich werden Server-Calls per X-API-Key erkannt. WICHTIG: NICHT PMS_API_KEY
// wiederverwenden — der liegt im westendOS-Frontend (pms-common.js) und ist
// Browser-exponiert. Dediziertes Secret PAYMENT_WORKER_API_KEY (neu generiert,
// nur serverseitig gehalten: Pages-Function-Proxy / PMS-Worker, nie im Frontend).
// Rückgabe: 'westendos' | 'tool'.
function authenticateCaller(request, env) {
  const key = request.headers.get("X-API-Key");
  if (key && env.PAYMENT_WORKER_API_KEY && key === env.PAYMENT_WORKER_API_KEY) return "westendos";
  return "tool";
}

// ── Helper: Adyen API Call ─────────────────────────────
async function adyenRequest(url, apiKey, body, idempotencyKey) {
  const headers = {
    "Content-Type": "application/json",
    "X-API-Key": apiKey,
  };
  // Adyen-Idempotenz: gleicher Key → Adyen verarbeitet den Call nur EINMAL und
  // liefert bei Wiederholung dasselbe Ergebnis (dedupliziert Doppel-Belastungen
  // an der Quelle, unabhängig vom DB-Claim). Nur setzen, wenn übergeben.
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await response.json();
  return { status: response.status, data };
}

// ── Helper: JSON Response ──────────────────────────────
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}

// ── Helper: Generate Booking ID ────────────────────────
function generateBookingId() {
  const now = new Date();
  const year = now.getFullYear();
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `WH-${year}-${rand}`;
}

// ── Helper: Build MIT Payment Payload ──────────────────
function buildMITPayload(merchantAccount, booking, reference) {
  return {
    merchantAccount: merchantAccount,
    amount: {
      value: booking.amount,
      currency: booking.currency,
    },
    reference: reference,
    shopperReference: booking.shopper_reference,
    paymentMethod: {
      storedPaymentMethodId: booking.adyen_token,
    },
    shopperInteraction: "ContAuth",
    recurringProcessingModel: "UnscheduledCardOnFile",
  };
}

// ── Helper: Build MIT Payload mit beliebigem Betrag (PMS) ─
function buildMITPayloadWithAmount(merchantAccount, booking, amountCents, currency, reference) {
  return {
    merchantAccount: merchantAccount,
    amount: { value: amountCents, currency: currency },
    reference: reference,
    shopperReference: booking.shopper_reference,
    paymentMethod: { storedPaymentMethodId: booking.adyen_token },
    shopperInteraction: "ContAuth",
    recurringProcessingModel: "UnscheduledCardOnFile",
  };
}

// ── Helper: Server-Auth-Check (v2.5.0 vereinheitlicht) ─────────────────
// Früher: X-PMS-API-Key == PMS_API_KEY. Abgelöst, weil PMS_API_KEY im
// westendOS-Frontend (pms-common.js) browser-exponiert ist und als Gate
// damit wertlos wäre. Jetzt: delegiert an authenticateCaller (X-API-Key ==
// PAYMENT_WORKER_API_KEY). Bleibt als Defense-in-Depth in den Handlern, das
// Router-Gate prüft zusätzlich vorgelagert.
// GRACE-WINDOW: Bestehende PMS→Payment-Worker-Calls auf /charge-amount,
//    /payment-link, /booking-token senden heute X-PMS-API-Key=PMS_API_KEY.
//    Diese drei Routen akzeptieren ÜBERGANGSWEISE BEIDE Wege (alter Header ODER
//    neuer Key), damit PayByLink/Angebotstool beim Deploy nicht bricht.
//    Folgeschritt (dokumentiert): PMS-Worker auf X-API-Key=PAYMENT_WORKER_API_KEY
//    umstellen → danach legacyPmsAuthValid() + PMS_API_KEY-Weg entfernen.
function legacyPmsAuthValid(request, env) {
  const k = request.headers.get("X-PMS-API-Key");
  return !!(k && env.PMS_API_KEY && k === env.PMS_API_KEY);
}
function checkPMSAuth(request, env) {
  if (authenticateCaller(request, env) === "westendos") return null;   // neuer Server-Key
  if (legacyPmsAuthValid(request, env)) return null;                   // GRACE: alter PMS-Key
  return errorResponse("Server-Key erforderlich (X-API-Key)", 401);
}

// ── Helper: Safe booking for frontend ──────────────────
function safeBooking(row) {
  const { adyen_token, ...safe } = row;
  safe.hasToken = !!adyen_token;
  return {
    bookingId: safe.booking_id,
    guestName: safe.guest_name,
    guestEmail: safe.guest_email,
    guestFirma: safe.guest_firma,
    guestTelefon: safe.guest_telefon,
    checkinDate: safe.checkin_date,
    checkoutDate: safe.checkout_date,
    zimmer: safe.zimmer,
    gesamtBetrag: safe.gesamt_betrag,
    amount: safe.amount,
    currency: safe.currency,
    chargeDate: safe.charge_date,
    status: safe.status,
    source: safe.source,
    shopperReference: safe.shopper_reference,
    pspReference: safe.psp_reference,
    adyenSessionId: safe.adyen_session_id,
    lastError: safe.last_error,
    rateType: safe.rate_type,
    stornoTyp: safe.storno_typ,
    rName: safe.r_name,
    rStrasse: safe.r_strasse,
    rPlzort: safe.r_plzort,
    rZusatz: safe.r_zusatz,
    angebotId: safe.angebot_id,
    angebotStatus: safe.angebot_status,
    createdAt: safe.created_at,
    updatedAt: safe.updated_at,
    chargedAt: safe.charged_at,
    cancelledAt: safe.cancelled_at,
    refundedAt: safe.refunded_at,
    refundAmount: safe.refund_amount,
    reminderSentAt: safe.reminder_sent_at,
    purpose: safe.purpose,
    reminderCount: safe.reminder_count,
    reminderLastStage: safe.reminder_last_stage,
    reservationId: safe.reservation_id,
    hasToken: safe.hasToken,
  };
}

// ── POST /session ──────────────────────────────────────
async function handleCreateSession(request, env) {
  const body = await request.json();
  const {
    bookingId,
    guestName,
    guestEmail,
    amount = 0,
    chargeAmount,
    chargeDate,
    currency = "EUR",
    source = "ecommerce",
    returnUrl,
    checkinDate,
    checkoutDate,
    zimmer,
    gesamtBetrag,
    rateType,
    stornoTyp,
    guestFirma,
    guestTelefon,
    rName,
    rStrasse,
    rPlzort,
    rZusatz,
    // v2.5.0: Karten-Zweck + westendOS-Referenz
    purpose,
    reservationId,
  } = body;

  // v2.5.0: Zweck explizit; Default konservativ = 'guarantee' (nie Auto-Charge).
  // charge_date nur bei charge_scheduled speichern (kein stiller Default mehr).
  const finalPurpose = (purpose === 'charge_scheduled' || purpose === 'guarantee') ? purpose : 'guarantee';
  const finalChargeDate = (finalPurpose === 'charge_scheduled') ? (chargeDate || null) : null;

  if (!guestName || !chargeAmount || !chargeDate) {
    return errorResponse("guestName, chargeAmount und chargeDate sind erforderlich");
  }

  const finalBookingId = bookingId || generateBookingId();
  const shopperReference = `guest_${finalBookingId}`;

  const sessionPayload = {
    merchantAccount: env.ADYEN_MERCHANT_ACCOUNT,
    amount: { value: amount, currency: currency },
    reference: finalBookingId,
    shopperReference: shopperReference,
    storePaymentMethod: true,
    recurringProcessingModel: "CardOnFile",
    // ⚠️ STAGING: returnUrl zeigt auf staging Pages-URL
    returnUrl: returnUrl || `https://booking-hotelwestend.de/payment-complete.html?bookingId=${finalBookingId}`,
    countryCode: "DE",
    shopperLocale: "de-DE",
    channel: "Web",
    // v2.2.1: Nur Kreditkarten zulassen (scheme = Visa/MC/Amex/etc.)
    // PayPal, Klarna, SEPA etc. unterstützen keine Zero-Auth-Tokenisierung
    // und führen zu "Acquirer Error" im CardOnFile-Flow.
    allowedPaymentMethods: ["scheme"],
  };

  if (source === "moto") {
    sessionPayload.shopperInteraction = "Moto";
    sessionPayload.authenticationData = { attemptAuthentication: "never" };
  }

  if (guestEmail) {
    sessionPayload.shopperEmail = guestEmail;
  }

  const result = await adyenRequest(
    `${adyenBase(env)}/sessions`,
    env.ADYEN_API_KEY,
    sessionPayload
  );

  if (result.status !== 201 && result.status !== 200) {
    console.error("Adyen session error:", JSON.stringify(result.data));
    return errorResponse(
      `Adyen Fehler: ${result.data.message || "Session konnte nicht erstellt werden"}`,
      result.status
    );
  }

  // Buchung in D1 speichern oder aktualisieren (falls bookingId schon existiert)
  const existingRow = bookingId
    ? await env.DB.prepare("SELECT booking_id FROM bookings WHERE booking_id = ?").bind(finalBookingId).first()
    : null;

  if (existingRow) {
    // Buchung existiert bereits (z.B. von moto.html CC-Link-Versand) → Session aktualisieren.
    // v2.5.0: purpose/charge_date/reservation_id mit aktualisieren (falls mitgeschickt).
    await env.DB.prepare(`
      UPDATE bookings SET adyen_session_id = ?, shopper_reference = ?,
        purpose = ?, charge_date = ?, reservation_id = COALESCE(?, reservation_id),
        status = 'pending_tokenization', updated_at = datetime('now')
      WHERE booking_id = ?
    `).bind(result.data.id, shopperReference, finalPurpose, finalChargeDate, reservationId || null, finalBookingId).run();
  } else {
    // Neue Buchung erstellen
    await env.DB.prepare(`
      INSERT INTO bookings (
        booking_id, guest_name, guest_email, guest_firma, guest_telefon,
        checkin_date, checkout_date, zimmer, gesamt_betrag,
        amount, currency, charge_date, status, source,
        shopper_reference, adyen_session_id,
        rate_type, storno_typ,
        r_name, r_strasse, r_plzort, r_zusatz,
        purpose, reservation_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      finalBookingId,
      guestName,
      guestEmail || "",
      guestFirma || "",
      guestTelefon || "",
      checkinDate || null,
      checkoutDate || null,
      zimmer || "",
      gesamtBetrag || 0,
      chargeAmount,
      currency,
      finalChargeDate,
      "pending_tokenization",
      source,
      shopperReference,
      result.data.id,
      rateType || "regulaer",
      stornoTyp || "regulaer",
      rName || "",
      rStrasse || "",
      rPlzort || "",
      rZusatz || "",
      finalPurpose,
      reservationId || null
    ).run();
  }

  return jsonResponse({
    bookingId: finalBookingId,
    sessionId: result.data.id,
    sessionData: result.data.sessionData,
    clientKey: env.ADYEN_CLIENT_KEY,
  });
}

// ── POST /bookings/from-offer (NEU v2.1, erweitert v2.4 für PMS-Korrespondenz) ──
async function handleCreateFromOffer(request, env) {
  const body = await request.json();
  const {
    guestName,
    guestEmail,
    guestFirma,
    guestTelefon,
    checkinDate,
    checkoutDate,
    zimmer,
    gesamtBetrag,
    currency = "EUR",
    stornoTyp = "regulaer",
    rName,
    rStrasse,
    rPlzort,
    rZusatz,
    angebotStatus = "offer_sent",
    emailType = "angebot",
    requireCC = false,
    // v2.4: PMS-specific fields
    source: requestSource,
    nights,
    ratePerNight,
    totalAmount,
    cancellationText,
    requireAgb = false,
    confirmUrl: wantConfirmUrl = false,
    reservationId,
    // v2.5.0: Karten-Zweck + explizites Belastungsdatum
    purpose,
    chargeDate,
  } = body;

  if (!guestName || !checkinDate || !checkoutDate) {
    return errorResponse("guestName, checkinDate und checkoutDate sind erforderlich");
  }

  const bookingId = generateBookingId();
  const isPMS = requestSource === 'pms';
  const amountCents = totalAmount || Math.round((gesamtBetrag || 0) * 100);
  const finalSource = isPMS ? 'pms' : 'angebotstool';

  let status;
  if (isPMS && requireCC) {
    status = "pending_tokenization";
  } else if (emailType === "bestaetigung" && requireCC) {
    status = "pending_tokenization";
  } else if (emailType === "bestaetigung") {
    status = "confirmed";
  } else {
    status = "offer_sent";
  }

  // v2.5.0: Karten-Zweck explizit. Default konservativ = 'guarantee' (nie Auto-Charge),
  // falls der Aufrufer keinen Zweck setzt. Vorbelegung/Vorschlag passiert im Frontend
  // (NON-CLX/flexibel → charge_scheduled, Regulär/Messe/Gruppe → guarantee).
  const finalPurpose = (purpose === 'charge_scheduled' || purpose === 'guarantee') ? purpose : 'guarantee';
  // charge_date NUR bei charge_scheduled und nur explizit — kein stiller Check-in-Default mehr (das war der Bug).
  const finalChargeDate = (finalPurpose === 'charge_scheduled') ? (chargeDate || null) : null;

  // v2.4/2.5: Extended columns (safe — extras are nullable)
  const cols = [
    'booking_id', 'guest_name', 'guest_email', 'guest_firma', 'guest_telefon',
    'checkin_date', 'checkout_date', 'zimmer', 'gesamt_betrag',
    'amount', 'currency', 'charge_date', 'status', 'source',
    'shopper_reference', 'storno_typ',
    'r_name', 'r_strasse', 'r_plzort', 'r_zusatz', 'angebot_status',
    'purpose', 'reservation_id'
  ];
  const vals = [
    bookingId, guestName, guestEmail || "", guestFirma || "", guestTelefon || "",
    checkinDate, checkoutDate, zimmer || "", gesamtBetrag || 0,
    amountCents, currency, finalChargeDate, status, finalSource,
    `guest_${bookingId}`, stornoTyp,
    rName || "", rStrasse || "", rPlzort || "", rZusatz || "", angebotStatus,
    finalPurpose, reservationId || null
  ];

  await env.DB.prepare(`
    INSERT INTO bookings (${cols.join(', ')})
    VALUES (${cols.map(() => '?').join(', ')})
  `).bind(...vals).run();

  // Build pay/confirm URL
  let payURL = null;
  let confirmURL = null;

  if (requireCC || wantConfirmUrl) {
    const payParams = new URLSearchParams({
      id: bookingId,
      name: guestName,
      email: guestEmail || "",
      checkin: checkinDate,
      checkout: checkoutDate,
      room: zimmer || "",
      amount: ((totalAmount || amountCents) / 100).toFixed(2),
      lang: "de",
    });

    if (wantConfirmUrl) {
      // v2.4: /confirm page (AGB + Zusammenfassung + Karte) — S3 landing page
      // For now: same as pay.html but with confirm=1 flag
      payParams.set('confirm', '1');
      if (requireAgb) payParams.set('agb', '1');
      if (cancellationText) payParams.set('storno', encodeURIComponent(cancellationText.substring(0, 200)));
      if (nights) payParams.set('nights', nights);
      if (ratePerNight) payParams.set('rate', ratePerNight);
      // v2.5.0: Gast-Basis-URLs aus env (default /pay,/confirm). Decoupled vom
      // Code-Deploy → Link-Umstellung exakt mit der Pages-Migration aktivierbar.
      // Pfade müssen dem CF-Access-Bypass entsprechen.
      confirmURL = `${env.GUEST_CONFIRM_URL || "https://booking-hotelwestend.de/confirm"}?${payParams.toString()}`;
    }
    payURL = `${env.GUEST_PAY_URL || "https://booking-hotelwestend.de/pay"}?${payParams.toString()}`;
  }

  return jsonResponse({
    success: true,
    bookingId,
    status,
    angebotStatus,
    payURL,
    confirmUrl: confirmURL,
    reservationId: reservationId || null,
  }, 201);
}

// ── POST /charge ───────────────────────────────────────
async function handleCharge(request, env) {
  const body = await request.json();
  const { bookingId } = body;

  if (!bookingId) {
    return errorResponse("bookingId ist erforderlich");
  }

  const row = await env.DB.prepare(
    "SELECT * FROM bookings WHERE booking_id = ?"
  ).bind(bookingId).first();

  if (!row) return errorResponse("Buchung nicht gefunden", 404);
  if (row.status === "charged") return errorResponse("Buchung wurde bereits belastet");
  if (row.status === "cancelled") return errorResponse("Buchung wurde storniert");
  if (!row.adyen_token) return errorResponse("Kein Zahlungstoken vorhanden – Gast hat noch keine Karte hinterlegt");

  const paymentPayload = buildMITPayload(
    env.ADYEN_MERCHANT_ACCOUNT,
    row,
    `${row.booking_id}-charge`
  );

  const result = await adyenRequest(
    `${adyenBase(env)}/payments`,
    env.ADYEN_API_KEY,
    paymentPayload
  );

  if (result.data.resultCode === "Authorised") {
    await env.DB.prepare(`
      UPDATE bookings SET status = 'charged', charged_at = datetime('now'),
        psp_reference = ?, updated_at = datetime('now')
      WHERE booking_id = ?
    `).bind(result.data.pspReference, bookingId).run();

    return jsonResponse({
      success: true, bookingId,
      pspReference: result.data.pspReference,
      resultCode: result.data.resultCode,
      amount: row.amount, currency: row.currency,
    });
  } else {
    await env.DB.prepare(`
      UPDATE bookings SET status = 'failed', last_error = ?, updated_at = datetime('now')
      WHERE booking_id = ?
    `).bind(result.data.resultCode, bookingId).run();

    return jsonResponse({
      success: false, bookingId,
      resultCode: result.data.resultCode,
      refusalReason: result.data.refusalReason || "Unbekannt",
    });
  }
}

// ══════════════════════════════════════════════════════════
// PMS-INTEGRATION (v2.3.0) – Adyen Charging
// ══════════════════════════════════════════════════════════

// ── POST /charge-amount ────────────────────────────────
// MIT-Belastung mit beliebigem Betrag (Variante 2: Gesamtbetrag inkl. Zusatzleistungen)
// Auth: X-PMS-API-Key
// Body: { bookingId, amount (cents), currency, reference, chargedBy }
async function handleChargeAmount(request, env) {
  const authError = checkPMSAuth(request, env);
  if (authError) return authError;

  const body = await request.json();
  const { bookingId, amount, currency = "EUR", reference, chargedBy } = body;

  if (!bookingId) return errorResponse("bookingId ist erforderlich");
  if (!amount || !Number.isInteger(amount) || amount <= 0) {
    return errorResponse("amount ist erforderlich (Integer in Cents, > 0)");
  }
  if (!reference) return errorResponse("reference ist erforderlich (z.B. Rechnungsnummer)");

  const row = await env.DB.prepare(
    "SELECT * FROM bookings WHERE booking_id = ?"
  ).bind(bookingId).first();

  if (!row) return errorResponse("Buchung nicht gefunden", 404);
  if (row.status === "cancelled") return errorResponse("Buchung wurde storniert");
  if (!row.adyen_token) {
    return errorResponse("Kein Zahlungstoken vorhanden – PayByLink verwenden", 422);
  }

  const paymentPayload = buildMITPayloadWithAmount(
    env.ADYEN_MERCHANT_ACCOUNT,
    row,
    amount,
    currency,
    reference
  );

  // Idempotency-Key aus der (eindeutigen) Rechnungsreferenz → schützt vor
  // Doppel-Belastung bei Doppelklick/Retry im Dashboard mit gleicher reference.
  const result = await adyenRequest(
    `${adyenBase(env)}/payments`,
    env.ADYEN_API_KEY,
    paymentPayload,
    `manual-${bookingId}-${reference}`
  );

  const success = result.data.resultCode === "Authorised";
  const pspRef = result.data.pspReference || null;
  const refusal = result.data.refusalReason || null;

  // charge_log: GoBD-konformer Audit-Trail jeder Belastung
  await env.DB.prepare(`
    INSERT INTO charge_log
      (booking_id, amount, currency, reference, psp_reference, result_code, refusal_reason, charged_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    bookingId, amount, currency, reference, pspRef,
    result.data.resultCode || "ERROR", refusal, chargedBy || "PMS"
  ).run();

  if (success) {
    // Booking-Status nur aktualisieren wenn Vollbetrag oder mehr belastet
    if (amount >= row.amount) {
      await env.DB.prepare(`
        UPDATE bookings SET status = 'charged', charged_at = datetime('now'),
          psp_reference = ?, updated_at = datetime('now')
        WHERE booking_id = ?
      `).bind(pspRef, bookingId).run();
    }
    return jsonResponse({
      success: true, bookingId, reference,
      pspReference: pspRef,
      resultCode: result.data.resultCode,
      amount, currency,
    });
  } else {
    await env.DB.prepare(`
      UPDATE bookings SET last_error = ?, updated_at = datetime('now')
      WHERE booking_id = ?
    `).bind(refusal || result.data.resultCode || "Unbekannt", bookingId).run();

    return jsonResponse({
      success: false, bookingId, reference,
      resultCode: result.data.resultCode,
      refusalReason: refusal || "Unbekannt",
    }, 200);
  }
}

// ── POST /payment-link ─────────────────────────────────
// Adyen Payment Link erstellen (PayByLink für Rechnungs-/Mahn-Emails)
// Auth: X-PMS-API-Key
// Body: { bookingId, amount (cents), currency, reference, description, expiresInDays }
async function handlePaymentLink(request, env) {
  const authError = checkPMSAuth(request, env);
  if (authError) return authError;

  const body = await request.json();
  const {
    bookingId, amount, currency = "EUR", reference,
    description, expiresInDays = 14
  } = body;

  if (!bookingId) return errorResponse("bookingId ist erforderlich");
  if (!amount || !Number.isInteger(amount) || amount <= 0) {
    return errorResponse("amount ist erforderlich (Integer in Cents, > 0)");
  }
  if (!reference) return errorResponse("reference ist erforderlich (z.B. Rechnungsnummer)");

  const row = await env.DB.prepare(
    "SELECT * FROM bookings WHERE booking_id = ?"
  ).bind(bookingId).first();

  if (!row) return errorResponse("Buchung nicht gefunden", 404);

  const expiresAt = new Date(Date.now() + expiresInDays * 86400000).toISOString();

  // Adyen Payment Links API: POST /paymentLinks
  // Hinweis: Payment Links nutzen die Adyen Checkout API auf der LIVE-URL
  const linkPayload = {
    merchantAccount: env.ADYEN_MERCHANT_ACCOUNT,
    reference: reference,
    amount: { value: amount, currency: currency },
    description: description || `Rechnung ${reference} – westendhotel`,
    expiresAt: expiresAt.replace(/\.\d{3}Z$/, "+00:00"), // Adyen will RFC3339
    shopperEmail: row.guest_email || undefined,
    shopperReference: row.shopper_reference || undefined,
    shopperName: row.guest_name ? {
      firstName: row.guest_name.split(" ")[0] || row.guest_name,
      lastName: row.guest_name.split(" ").slice(1).join(" ") || ".",
    } : undefined,
    countryCode: "DE",
    returnUrl: "https://booking-hotelwestend.de/payment-success",
  };

  const result = await adyenRequest(
    `${adyenBase(env)}/paymentLinks`,
    env.ADYEN_API_KEY,
    linkPayload
  );

  if (result.status >= 400 || !result.data.url) {
    console.error("Payment Link creation failed:", JSON.stringify(result.data));
    return errorResponse(
      `Payment Link konnte nicht erstellt werden: ${result.data.message || result.data.errorCode || "Unbekannt"}`,
      502
    );
  }

  await env.DB.prepare(`
    INSERT INTO payment_links
      (booking_id, adyen_link_id, reference, amount, currency, url, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    bookingId, result.data.id, reference, amount, currency,
    result.data.url, expiresAt
  ).run();

  return jsonResponse({
    success: true, bookingId, reference,
    linkId: result.data.id,
    url: result.data.url,
    amount, currency,
    expiresAt,
    status: result.data.status,
  });
}

// ── GET /booking-token/:bookingId ──────────────────────
// Token-Status für PMS-Lookup (Live-Lookup-Architektur, kein Token-Sync)
// Auth: X-PMS-API-Key
// Liefert: hasToken, status + Booking-Metadaten
async function handleBookingToken(bookingId, request, env) {
  const authError = checkPMSAuth(request, env);
  if (authError) return authError;

  const row = await env.DB.prepare(
    "SELECT booking_id, guest_name, guest_email, amount, currency, status, adyen_token, shopper_reference, charged_at FROM bookings WHERE booking_id = ?"
  ).bind(bookingId).first();

  if (!row) return errorResponse("Buchung nicht gefunden", 404);

  return jsonResponse({
    bookingId: row.booking_id,
    hasToken: !!row.adyen_token,
    status: row.status,
    guestName: row.guest_name,
    guestEmail: row.guest_email,
    amount: row.amount,
    currency: row.currency,
    shopperReference: row.shopper_reference,
    chargedAt: row.charged_at,
  });
}

// ══════════════════════════════════════════════════════════
// Ende PMS-INTEGRATION (v2.3.0)
// ══════════════════════════════════════════════════════════

// ── POST /webhook ──────────────────────────────────────
async function handleWebhook(request, env) {
  const body = await request.json();
  const notifications = body.notificationItems || [];

  for (const item of notifications) {
    const notification = item.NotificationRequestItem;

    // v2.5.0: HMAC-Signatur verifizieren. Verhindert, dass Dritte mit Kenntnis der
    // Webhook-URL Status-Updates einspielen (z.B. Buchung auf 'charged' setzen).
    // Zweistufig über HMAC_MODE: 'log' (Default nach Deploy — prüfen + nur loggen,
    // Notification wird weiter verarbeitet) → nach 2–3 Tagen sauberem Log auf
    // 'enforce' (401 bei fehlender/falscher Signatur). Voraussetzung: identischer
    // HMAC-Key in Adyen-Webhook-Konfig UND als Secret ADYEN_HMAC_KEY.
    const hmacMode = (env.HMAC_MODE === "enforce") ? "enforce" : "log";
    const hmacOk = await verifyAdyenHmac(notification, env.ADYEN_HMAC_KEY);
    if (!hmacOk) {
      console.error(`Webhook HMAC ungültig/fehlend (ref=${notification.merchantReference || "?"}, event=${notification.eventCode || "?"}, mode=${hmacMode})`);
      if (hmacMode === "enforce") {
        return new Response("[unauthorized]", { status: 401, headers: { "Content-Type": "text/plain" } });
      }
      // log-Modus: bewusst weiterverarbeiten (nur protokolliert)
    }

    const { eventCode, success, merchantReference, pspReference, additionalData, amount } = notification;

    console.log(`Webhook: ${eventCode} for ${merchantReference} – success: ${success}`);

    // ── PayByLink-Zahlung? Reference matched ein Payment-Link-Reference ──
    // Adyen sendet bei Payment-Link-Zahlungen AUTHORISATION mit der Link-Reference
    const linkRow = await env.DB.prepare(
      "SELECT * FROM payment_links WHERE reference = ? AND status = 'active'"
    ).bind(merchantReference).first();

    if (linkRow && eventCode === "AUTHORISATION") {
      if (success === "true") {
        await env.DB.prepare(`
          UPDATE payment_links
          SET status = 'paid', paid_at = datetime('now'), psp_reference = ?
          WHERE id = ?
        `).bind(pspReference, linkRow.id).run();

        // Booking-Status aktualisieren wenn Vollbetrag bezahlt
        const booking = await env.DB.prepare(
          "SELECT * FROM bookings WHERE booking_id = ?"
        ).bind(linkRow.booking_id).first();

        if (booking && linkRow.amount >= booking.amount) {
          await env.DB.prepare(`
            UPDATE bookings SET status = 'charged', charged_at = datetime('now'),
              psp_reference = ?, updated_at = datetime('now')
            WHERE booking_id = ?
          `).bind(pspReference, linkRow.booking_id).run();
        }

        // Audit-Trail im charge_log
        await env.DB.prepare(`
          INSERT INTO charge_log
            (booking_id, amount, currency, reference, psp_reference, result_code, charged_by)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          linkRow.booking_id, linkRow.amount, linkRow.currency,
          merchantReference, pspReference, "Authorised", "PayByLink"
        ).run();

        console.log(`PayByLink-Zahlung verbucht: ${merchantReference}`);
      } else {
        console.log(`PayByLink-Zahlung fehlgeschlagen: ${merchantReference}`);
      }
      continue; // PayByLink behandelt, nicht in Booking-Logik weitergeben
    }

    // ── Standard-Booking-Webhook (Tokenisierung, MIT-Charging) ──
    const row = await env.DB.prepare(
      "SELECT * FROM bookings WHERE booking_id = ?"
    ).bind(merchantReference).first();

    if (!row) {
      console.log(`Buchung ${merchantReference} nicht gefunden`);
      continue;
    }

    switch (eventCode) {
      case "AUTHORISATION":
        if (success === "true") {
          let token = null;
          let shopperRef = row.shopper_reference;
          if (additionalData) {
            token = additionalData["tokenization.storedPaymentMethodId"]
              || additionalData["recurring.recurringDetailReference"]
              || null;
            if (additionalData["recurring.shopperReference"]) {
              shopperRef = additionalData["recurring.shopperReference"];
            }
          }
          await env.DB.prepare(`
            UPDATE bookings SET status = 'pending', adyen_token = ?,
              shopper_reference = ?, psp_reference = ?, updated_at = datetime('now')
            WHERE booking_id = ?
          `).bind(token, shopperRef, pspReference, merchantReference).run();
        } else {
          await env.DB.prepare(`
            UPDATE bookings SET status = 'tokenization_failed',
              last_error = ?, updated_at = datetime('now')
            WHERE booking_id = ?
          `).bind(notification.reason || "Autorisierung fehlgeschlagen", merchantReference).run();
        }
        break;

      case "CAPTURE":
        if (success === "true") {
          await env.DB.prepare(`
            UPDATE bookings SET status = 'charged', charged_at = datetime('now'),
              updated_at = datetime('now')
            WHERE booking_id = ?
          `).bind(merchantReference).run();
        }
        break;

      case "CANCELLATION":
        await env.DB.prepare(`
          UPDATE bookings SET status = 'cancelled', updated_at = datetime('now')
          WHERE booking_id = ?
        `).bind(merchantReference).run();
        break;

      case "REFUND":
        if (success === "true") {
          await env.DB.prepare(`
            UPDATE bookings SET status = 'refunded', refunded_at = datetime('now'),
              updated_at = datetime('now')
            WHERE booking_id = ?
          `).bind(merchantReference).run();
        }
        break;

      default:
        console.log(`Unbekannter eventCode: ${eventCode}`);
    }
  }

  return new Response("[accepted]", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

// ── GET /bookings ──────────────────────────────────────
async function handleGetBookings(env, url) {
  const status = url.searchParams.get("status");

  let query = "SELECT * FROM bookings";
  const params = [];

  if (status) {
    query += " WHERE status = ?";
    params.push(status);
  }

  query += " ORDER BY created_at DESC";

  const { results } = params.length
    ? await env.DB.prepare(query).bind(...params).all()
    : await env.DB.prepare(query).all();

  const bookings = (results || []).map(safeBooking);

  return jsonResponse({ bookings, total: bookings.length });
}

// ── GET /bookings/:id ──────────────────────────────────
async function handleGetBooking(bookingId, env) {
  const row = await env.DB.prepare(
    "SELECT * FROM bookings WHERE booking_id = ?"
  ).bind(bookingId).first();

  if (!row) return errorResponse("Buchung nicht gefunden", 404);
  return jsonResponse(safeBooking(row));
}

// ── PUT /bookings/:id ──────────────────────────────────
async function handleUpdateBooking(bookingId, request, env) {
  const row = await env.DB.prepare(
    "SELECT * FROM bookings WHERE booking_id = ?"
  ).bind(bookingId).first();

  if (!row) return errorResponse("Buchung nicht gefunden", 404);
  if (row.status === "charged" || row.status === "refunded") {
    return errorResponse("Bereits abgeschlossene Buchungen können nicht geändert werden");
  }

  const updates = await request.json();
  const fieldMap = {
    amount: "amount",
    chargeDate: "charge_date",
    guestName: "guest_name",
    guestEmail: "guest_email",
    status: "status",
    checkinDate: "checkin_date",
    checkoutDate: "checkout_date",
    rateType: "rate_type",
    stornoTyp: "storno_typ",
    zimmer: "zimmer",
    gesamtBetrag: "gesamt_betrag",
    angebotStatus: "angebot_status",
  };

  const setClauses = [];
  const values = [];

  for (const [camelKey, dbCol] of Object.entries(fieldMap)) {
    if (updates[camelKey] !== undefined) {
      setClauses.push(`${dbCol} = ?`);
      values.push(updates[camelKey]);
    }
  }

  if (setClauses.length === 0) {
    return errorResponse("Keine gültigen Felder zum Aktualisieren");
  }

  setClauses.push("updated_at = datetime('now')");
  values.push(bookingId);

  await env.DB.prepare(
    `UPDATE bookings SET ${setClauses.join(", ")} WHERE booking_id = ?`
  ).bind(...values).run();

  return jsonResponse({ success: true, bookingId, updated: Object.keys(updates) });
}

// ── DELETE /bookings/:id ───────────────────────────────
async function handleCancelBooking(bookingId, env) {
  const row = await env.DB.prepare(
    "SELECT * FROM bookings WHERE booking_id = ?"
  ).bind(bookingId).first();

  if (!row) return errorResponse("Buchung nicht gefunden", 404);
  if (row.status === "charged") {
    return errorResponse("Bereits belastete Buchung kann nicht storniert werden – nutze Refund");
  }

  await env.DB.prepare(`
    UPDATE bookings SET status = 'cancelled', cancelled_at = datetime('now'),
      updated_at = datetime('now')
    WHERE booking_id = ?
  `).bind(bookingId).run();

  return jsonResponse({ success: true, bookingId, status: "cancelled" });
}

// ── POST /bookings/:id/refund ──────────────────────────
async function handleRefund(bookingId, request, env) {
  const row = await env.DB.prepare(
    "SELECT * FROM bookings WHERE booking_id = ?"
  ).bind(bookingId).first();

  if (!row) return errorResponse("Buchung nicht gefunden", 404);
  if (row.status !== "charged") return errorResponse("Nur belastete Buchungen können erstattet werden");
  if (!row.psp_reference) return errorResponse("Keine pspReference vorhanden – Erstattung nicht möglich");

  const body = await request.json().catch(() => ({}));
  const refundAmount = body.amount || row.amount;

  const refundPayload = {
    merchantAccount: env.ADYEN_MERCHANT_ACCOUNT,
    amount: { value: refundAmount, currency: row.currency },
    reference: `${row.booking_id}-refund`,
  };

  const result = await adyenRequest(
    `${adyenBase(env)}/payments/${row.psp_reference}/refunds`,
    env.ADYEN_API_KEY,
    refundPayload
  );

  if (result.data.status === "received" || result.status === 201 || result.status === 200) {
    await env.DB.prepare(`
      UPDATE bookings SET status = 'refund_pending', refund_amount = ?,
        updated_at = datetime('now')
      WHERE booking_id = ?
    `).bind(refundAmount, bookingId).run();

    return jsonResponse({ success: true, bookingId, refundAmount, message: "Erstattung eingeleitet" });
  } else {
    return errorResponse(`Erstattung fehlgeschlagen: ${result.data.message || result.data.errorCode || "Unbekannter Fehler"}`);
  }
}

// ── Helper: Build Reminder Email HTML ──────────────────
function buildReminderEmail(booking, payURL, isFailed = false) {
  const checkin = booking.checkin_date ? booking.checkin_date.split('-').reverse().join('.') : '–';
  const checkout = booking.checkout_date ? booking.checkout_date.split('-').reverse().join('.') : '–';
  const betragEur = (booking.amount || 0) / 100;
  const betrag = betragEur.toFixed(2).replace('.', ',');
  const guestName = booking.guest_name || 'Gast';

  // v2.5.0: Text nach purpose differenziert (guarantee = beruhigend „keine Belastung",
  // charge_scheduled = informiert über die geplante Belastung inkl. Datum).
  const chargeDateDE = booking.charge_date ? booking.charge_date.split('-').reverse().join('.') : null;
  let introText;
  if (isFailed) {
    introText = `leider konnte Ihre Kreditkarte für Ihren bevorstehenden Aufenthalt nicht erfolgreich hinterlegt werden. Bitte versuchen Sie es erneut über den untenstehenden Link.`;
  } else if (booking.purpose === 'charge_scheduled') {
    introText = `wir möchten Sie freundlich daran erinnern, Ihre Kreditkarte für Ihren bevorstehenden Aufenthalt zu hinterlegen.${chargeDateDE ? ` Die vereinbarte Belastung erfolgt am ${chargeDateDE}.` : ''}`;
  } else {
    // guarantee (auch Default für Alt-Buchungen ohne purpose)
    introText = `wir möchten Sie freundlich daran erinnern, Ihre Kreditkarte für Ihren bevorstehenden Aufenthalt zu hinterlegen. Dies dient lediglich zur Absicherung Ihrer Buchung – Ihre Karte wird nicht automatisch belastet.`;
  }

  const bannerText = isFailed ? 'KREDITKARTE ERNEUT HINTERLEGEN' : 'ERINNERUNG – KREDITKARTE HINTERLEGEN';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#EEECEA;margin:0;padding:0;">
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#EEECEA;">
<tr><td align="center" style="padding:20px;">

<table cellpadding="0" cellspacing="0" border="0" width="580" style="max-width:580px;border-radius:12px;overflow:hidden;">

  <tr>
    <td style="background:#3B4547;padding:28px 24px 22px;text-align:center;">
      <img src="https://duemler90431.github.io/westend-tool/wh-logo_weiss_transparent.png" alt="westendhotel" style="height:38px;display:block;margin:0 auto 8px;">
      <div style="font-size:10px;color:rgba(255,255,255,0.35);letter-spacing:2.5px;">N&#220;RNBERG &#183; KARL-MARTELL-STR. 42&#8211;44</div>
    </td>
  </tr>

  <tr>
    <td style="background:#2A6B7C;padding:10px 24px;text-align:center;">
      <span style="font-size:11px;font-weight:bold;color:#fff;letter-spacing:3px;text-transform:uppercase;">${bannerText}</span>
    </td>
  </tr>

  <tr>
    <td style="background:#ffffff;padding:24px;">

      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:20px;">
        <tr><td style="padding:0 4px;">
          <p style="font-size:14px;color:#3B4547;line-height:1.6;margin:0;">Sehr geehrte/r ${guestName},</p>
          <p style="font-size:14px;color:#3B4547;line-height:1.65;margin:14px 0 0;">${introText}</p>
        </td></tr>
      </table>

      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:16px;">
        <tr><td style="border:1px solid #E0DDD6;border-radius:12px;overflow:hidden;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr><td style="padding:13px 20px;border-bottom:1px solid #E8E6E0;">
              <span style="font-size:10px;font-weight:bold;color:#3B4547;letter-spacing:1.5px;text-transform:uppercase;">BUCHUNGSDETAILS</span>
            </td></tr>
          </table>
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="padding:11px 20px;font-size:13px;color:#888;border-bottom:1px solid #F0EDE8;width:140px;">Anreise</td>
              <td style="padding:11px 20px;font-size:13px;font-weight:bold;color:#3B4547;border-bottom:1px solid #F0EDE8;text-align:right;">${checkin}</td>
            </tr>
            <tr>
              <td style="padding:11px 20px;font-size:13px;color:#888;border-bottom:1px solid #F0EDE8;">Abreise</td>
              <td style="padding:11px 20px;font-size:13px;font-weight:bold;color:#3B4547;border-bottom:1px solid #F0EDE8;text-align:right;">${checkout}</td>
            </tr>
            ${booking.zimmer ? `<tr>
              <td style="padding:11px 20px;font-size:13px;color:#888;border-bottom:1px solid #F0EDE8;">Zimmer</td>
              <td style="padding:11px 20px;font-size:13px;font-weight:bold;color:#3B4547;border-bottom:1px solid #F0EDE8;text-align:right;">${booking.zimmer}</td>
            </tr>` : ''}
          </table>
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="background:#3B4547;padding:14px 20px;">
                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td style="font-size:12px;font-weight:bold;color:rgba(255,255,255,0.65);">Betrag</td>
                    <td style="font-size:18px;font-weight:bold;color:#ffffff;text-align:right;">&#8364; ${betrag}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>

      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:16px;">
        <tr><td align="center" style="padding:4px 0;">
          <table cellpadding="0" cellspacing="0" border="0">
            <tr><td style="background:#3B4547;border-radius:8px;padding:12px 36px;text-align:center;">
              <a href="${payURL}" target="_blank" style="font-size:14px;font-weight:bold;color:#ffffff;letter-spacing:0.3px;text-decoration:none;">&#128179; Kreditkarte hinterlegen</a>
            </td></tr>
          </table>
        </td></tr>
      </table>

      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:16px;">
        <tr><td style="border:1px solid #E0DDD6;border-left:3px solid #2A6B7C;border-radius:12px;padding:16px 20px;">
          <div style="font-size:12px;color:#888;line-height:1.55;">Die Karte wird nur zur Sicherheit gespeichert. Eine Belastung erfolgt erst gem&#228;&#223; den vereinbarten Buchungs- und Stornobedingungen.</div>
        </td></tr>
      </table>

      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:8px;">
        <tr><td style="padding:0 4px;">
          <p style="font-size:13px;color:#3B4547;line-height:1.6;margin:0;">Mit freundlichen Gr&#252;&#223;en,<br><strong>westendhotel n&#252;rnberg</strong></p>
        </td></tr>
      </table>

    </td>
  </tr>

  <tr>
    <td style="background:#3B4547;padding:20px 24px;text-align:center;">
      <img src="https://duemler90431.github.io/westend-tool/wh-logo_weiss_transparent.png" alt="westendhotel" style="height:28px;display:block;margin:0 auto 10px;">
      <div style="font-size:11px;color:rgba(255,255,255,0.5);line-height:1.8;">
        Karl-Martell-Str. 42&#8211;44 &#183; 90431 N&#252;rnberg<br>
        Tel: +49 911 93986-0 &#183; info&#64;hotelwestend.de<br>
        www.hotelwestend.de
      </div>
      <div style="margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.12);font-size:9px;color:rgba(255,255,255,0.3);line-height:1.6;">
        MORE Hospitality GmbH &#183; Karl-Martell-Str. 42&#8211;44 &#183; 90431 N&#252;rnberg<br>
        Gesch&#228;ftsf&#252;hrer: Daniel D&#252;mler &#183; HRB 41876 &#183; AG N&#252;rnberg
      </div>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body></html>`;
}

// ── Helper: Send Reminder via Brevo ─────────────
async function sendReminderViaBrevo(booking, payURL, isFailed, apiKey) {
  const emailHTML = buildReminderEmail(booking, payURL, isFailed);
  const subject = isFailed
    ? `westendhotel nürnberg – Kreditkarte erneut hinterlegen`
    : `westendhotel nürnberg – Erinnerung: Kreditkarte hinterlegen`;

  const res = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      sender: { name: "westendhotel nürnberg", email: "info@hotelwestend.de" },
      to: [{ email: booking.guest_email, name: booking.guest_name }],
      subject: subject,
      htmlContent: emailHTML,
    }),
  });

  const responseText = await res.text();
  console.log(`Brevo response for ${booking.booking_id}: ${res.status} – ${responseText}`);

  // v2.4: messageId aus JSON-Response extrahieren für email_log/Webhook-Matching
  let messageId = null;
  try {
    const parsed = JSON.parse(responseText);
    messageId = parsed.messageId || null;
  } catch (e) {
    // Body war kein valides JSON (z.B. bei 4xx-Fehlern) – messageId bleibt null
  }

  return {
    ok: res.ok || res.status === 201,
    status: res.status,
    body: responseText,
    messageId,
    subject,
  };
}

// ── Helper: Log Email to PMS email_log (v2.4) ─────────────
// Fire-and-forget via Service Binding. Fehler blockieren den Mailversand nicht.
async function logEmailToPMS(env, payload) {
  // Service Binding optional: wenn nicht konfiguriert, still skip.
  if (!env.PMS || typeof env.PMS.fetch !== 'function') {
    console.warn('logEmailToPMS: Service Binding PMS nicht konfiguriert – skip');
    return;
  }

  try {
    const res = await env.PMS.fetch('https://pms-internal/api/email-log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PMS-API-Key': env.PMS_API_KEY || '',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.warn(`logEmailToPMS: PMS returned ${res.status} – ${txt}`);
    }
  } catch (err) {
    // Fire-and-forget: nie werfen
    console.warn(`logEmailToPMS: ${err.message}`);
  }
}

// ── POST /bookings/:id/remind ─────────────────────────
async function handleSendReminder(bookingId, env) {
  const row = await env.DB.prepare(
    "SELECT * FROM bookings WHERE booking_id = ?"
  ).bind(bookingId).first();

  if (!row) return errorResponse("Buchung nicht gefunden", 404);
  if (!['pending_tokenization', 'tokenization_failed'].includes(row.status)) {
    return errorResponse("Erinnerung nur für Buchungen mit Status 'Warte auf Karte' oder 'Fehlgeschlagen' möglich");
  }
  if (!row.guest_email) {
    return errorResponse("Keine E-Mail-Adresse vorhanden");
  }

  // Build pay.html URL
  const payParams = new URLSearchParams({
    id: row.booking_id,
    name: row.guest_name,
    email: row.guest_email,
    checkin: row.checkin_date || '',
    checkout: row.checkout_date || '',
    room: row.zimmer || '',
    amount: (row.gesamt_betrag || 0).toFixed(2),
    lang: 'de',
  });
  // v2.5.0: Gast-Basis-URL aus env (default /pay) — decoupled vom Code-Deploy
  const payURL = `${env.GUEST_PAY_URL || "https://booking-hotelwestend.de/pay"}?${payParams.toString()}`;
  const isFailed = row.status === 'tokenization_failed';

  const result = await sendReminderViaBrevo(row, payURL, isFailed, env.BREVO_API_KEY);

  if (result.ok) {
    // v2.5.0: manuelle Reminder zählen ebenfalls mit (Deckelung/Warnung im Dashboard).
    await env.DB.prepare(`
      UPDATE bookings SET reminder_sent_at = datetime('now'),
        reminder_count = reminder_count + 1, reminder_last_stage = 'manual',
        updated_at = datetime('now')
      WHERE booking_id = ?
    `).bind(bookingId).run();
    const priorCount = row.reminder_count || 0;
    const warning = priorCount >= 2
      ? `Achtung: bereits ${priorCount} Erinnerungen an den Gast gesendet — weitere Eskalation bitte intern statt per Gast-Mail.`
      : null;

    // v2.4: email_log-Eintrag im PMS (fire-and-forget)
    await logEmailToPMS(env, {
      channel: 'payment-worker',
      template_key: isFailed ? 'tokenization_failed_reminder' : 'tokenization_reminder',
      type: 'payment_reminder',
      from_email: 'info@hotelwestend.de',
      to_email: row.guest_email,
      subject: result.subject,
      brevo_message_id: result.messageId,
      status: 'sent',
      created_by: 'payment-worker:manual',
      // Referenz-Felder (Lookup-Strategie im PMS-Endpoint)
      external_booking_id: row.booking_id, // PMS kann damit guest_id/reservation_id auflösen
    });

    return jsonResponse({ success: true, bookingId, message: "Erinnerungsmail gesendet", reminderCount: priorCount + 1, warning });
  } else {
    return errorResponse(`E-Mail-Versand fehlgeschlagen (${result.status}): ${result.body}`);
  }
}

// ── Cron Trigger ───────────────────────────────────────
async function handleScheduled(event, env) {
  console.log("Cron: Prüfe fällige Zahlungen...");

  const today = new Date().toISOString().split("T")[0];

  const { results } = await env.DB.prepare(`
    SELECT * FROM bookings
    WHERE status = 'pending'
      AND adyen_token IS NOT NULL
      AND purpose = 'charge_scheduled'
      AND charge_date IS NOT NULL
      AND charge_date <= ?
  `).bind(today).all();

  let charged = 0;
  let failed = 0;
  let claim_lost = 0;   // Läufe, die den atomaren Claim verloren (paralleler/doppelter Cron)

  for (const booking of results || []) {
    // ── Atomarer Claim VOR dem Adyen-Call — schließt das Race-Fenster ──
    // Nur der Lauf, der 'pending'→'charging' schafft (changes=1), belastet.
    // Ein zweiter/überlappender Cron (CF-Retry, Deploy-Übergang) sieht changes=0
    // und überspringt → kein Doppel-Charge. Der Guard wandert damit vom stale
    // SELECT in einen primary-seitigen bedingten Write (konsistent, race-frei).
    // Hinweis: Bricht der Worker zwischen Claim und Abschluss ab, bleibt die
    // Buchung in 'charging' hängen (NIE erneut belastet — sichere Fehlerseite;
    // stale 'charging' ggf. per Monitor/manuell auf 'failed' zurücksetzen).
    const claim = await env.DB.prepare(
      "UPDATE bookings SET status='charging', updated_at=datetime('now') WHERE booking_id=? AND status='pending'"
    ).bind(booking.booking_id).run();
    if ((claim.meta?.changes || 0) !== 1) { claim_lost++; continue; }

    console.log(`Cron: Belaste ${booking.booking_id} – ${booking.amount} ${booking.currency}`);

    const reference = `${booking.booking_id}-charge`;
    const paymentPayload = buildMITPayload(env.ADYEN_MERCHANT_ACCOUNT, booking, reference);
    // Deterministischer Idempotency-Key (booking+charge_date) → Adyen dedupliziert
    // selbst, falls trotz Claim je zwei Calls durchkämen (Defense-in-Depth).
    const idemKey = `cron-${booking.booking_id}-${booking.charge_date}`;

    let resultCode = "ERROR", pspRef = null, refusal = null;
    try {
      const result = await adyenRequest(
        `${adyenBase(env)}/payments`,
        env.ADYEN_API_KEY,
        paymentPayload,
        idemKey
      );
      resultCode = result.data.resultCode || "ERROR";
      pspRef = result.data.pspReference || null;
      refusal = result.data.refusalReason || null;

      if (resultCode === "Authorised") {
        await env.DB.prepare(`
          UPDATE bookings SET status = 'charged', charged_at = datetime('now'),
            psp_reference = ?, updated_at = datetime('now')
          WHERE booking_id = ?
        `).bind(pspRef, booking.booking_id).run();
        charged++;
      } else {
        await env.DB.prepare(`
          UPDATE bookings SET status = 'failed',
            last_error = ?, updated_at = datetime('now')
          WHERE booking_id = ?
        `).bind(refusal || resultCode, booking.booking_id).run();
        failed++;
      }
    } catch (err) {
      refusal = err.message;
      await env.DB.prepare(`
        UPDATE bookings SET status = 'failed',
          last_error = ?, updated_at = datetime('now')
        WHERE booking_id = ?
      `).bind(err.message, booking.booking_id).run();
      failed++;
    }

    // ── GoBD-Audit-Trail AUCH für Cron-Belastungen (bisher nur /charge-amount) ──
    // Der automatische Pfad bekommt die beste Spur, nicht die schwächste.
    await env.DB.prepare(`
      INSERT INTO charge_log
        (booking_id, amount, currency, reference, psp_reference, result_code, refusal_reason, charged_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      booking.booking_id, booking.amount, booking.currency, reference,
      pspRef, resultCode, refusal, 'cron'
    ).run();
  }

  const expireResult = await env.DB.prepare(`
    UPDATE bookings SET status = 'expired', updated_at = datetime('now')
    WHERE status IN ('pending', 'pending_tokenization', 'failed')
      AND checkout_date IS NOT NULL
      AND checkout_date < date(?, '-7 days')
  `).bind(today).run();

  const expired = expireResult.meta?.changes || 0;

  const skipped = (await env.DB.prepare(
    "SELECT COUNT(*) as cnt FROM bookings WHERE status NOT IN ('pending', 'pending_tokenization')"
  ).first()).cnt;

  console.log(`Cron fertig: ${charged} belastet, ${failed} fehlgeschlagen, ${expired} expired, ${skipped} übersprungen, ${claim_lost} claim-verloren`);

  // ── Step 3: Automatische Erinnerungsmails ───────────
  // Kriterien: status pending_tokenization oder tokenization_failed,
  // erstellt vor >24h, reminder noch nicht gesendet, Check-in nicht heute,
  // E-Mail vorhanden
  // v2.5.0: Reminder-Staffel — max 2 Gast-Mails, danach nur intern (Dashboard-Hinweis).
  //   R1: ~3 Tage nach Anlage (reminder_count=0)
  //   R2: 5–7 Tage vor dem relevanten Datum (charge_date bei charge_scheduled, sonst check_in),
  //       nur wenn weiterhin kein Token (reminder_count=1)
  // Dringlichkeit richtet sich nach purpose über das relevante Datum.
  const reminderResults = await env.DB.prepare(`
    SELECT * FROM bookings
    WHERE status IN ('pending_tokenization', 'tokenization_failed')
      AND guest_email != ''
      AND reminder_count < 2
  `).all();

  const _daysUntil = (dateStr) => {
    if (!dateStr) return null;
    return Math.round((new Date(dateStr + 'T00:00:00Z') - new Date(today + 'T00:00:00Z')) / 86400000);
  };
  const _hoursSince = (ts) => (Date.now() - new Date((ts || '').replace(' ', 'T') + 'Z')) / 3600000;

  let reminded = 0;
  for (const booking of reminderResults.results || []) {
    // Zweck-abhängiges relevantes Datum
    const relevantDate = booking.charge_date || booking.checkin_date || null;
    const daysUntil = _daysUntil(relevantDate);
    // relevantes Datum bereits erreicht/überschritten → keine Gast-Mail mehr (nur intern)
    if (daysUntil !== null && daysUntil <= 0) continue;

    let stage = null;
    if (booking.reminder_count === 0) {
      // R1: frühestens 3 Tage nach Anlage (statt bisher 24h → weniger aufdringlich)
      if (_hoursSince(booking.created_at) >= 72) stage = 'r1';
    } else if (booking.reminder_count === 1) {
      // R2: nur wenn ein relevantes Datum bekannt ist und wir im 7-Tage-Fenster davor sind
      if (daysUntil !== null && daysUntil <= 7) stage = 'r2';
    }
    if (!stage) continue;
    const payParams = new URLSearchParams({
      id: booking.booking_id,
      name: booking.guest_name,
      email: booking.guest_email,
      checkin: booking.checkin_date || '',
      checkout: booking.checkout_date || '',
      room: booking.zimmer || '',
      amount: (booking.gesamt_betrag || 0).toFixed(2),
      lang: 'de',
    });
    // v2.5.0: Gast-Basis-URL aus env (default /pay). Erlaubt, die Link-Umstellung
    // exakt mit der Pages-Migration zu aktivieren, ohne Worker-Redeploy.
    const payURL = `${env.GUEST_PAY_URL || "https://booking-hotelwestend.de/pay"}?${payParams.toString()}`;
    const isFailed = booking.status === 'tokenization_failed';

    try {
      const result = await sendReminderViaBrevo(booking, payURL, isFailed, env.BREVO_API_KEY);
      if (result.ok) {
        await env.DB.prepare(`
          UPDATE bookings SET reminder_sent_at = datetime('now'),
            reminder_count = reminder_count + 1, reminder_last_stage = ?,
            updated_at = datetime('now')
          WHERE booking_id = ?
        `).bind(stage, booking.booking_id).run();
        reminded++;
        console.log(`Cron: Erinnerung ${stage} gesendet an ${booking.guest_email} für ${booking.booking_id}`);

        // v2.4: email_log-Eintrag im PMS (fire-and-forget)
        await logEmailToPMS(env, {
          channel: 'payment-worker',
          template_key: isFailed ? 'tokenization_failed_reminder' : 'tokenization_reminder',
          type: 'payment_reminder',
          from_email: 'info@hotelwestend.de',
          to_email: booking.guest_email,
          subject: result.subject,
          brevo_message_id: result.messageId,
          status: 'sent',
          created_by: 'payment-worker:cron',
          external_booking_id: booking.booking_id,
        });
      }
    } catch (err) {
      console.error(`Cron: Erinnerung fehlgeschlagen für ${booking.booking_id}: ${err.message}`);
    }
  }

  console.log(`Cron: ${reminded} Erinnerungsmails gesendet`);
}

// ── Router ─────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const allowOrigin = resolveCorsOrigin(request, env);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: { ...CORS_HEADERS, "Access-Control-Allow-Origin": allowOrigin, "Vary": "Origin" },
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // ── v2.5.0 Auth-Gate ────────────────────────────────────────────────
    // GENAU EINE offene Route: POST /session (Gast-Tokenisierung via pay.html).
    // Zusätzlich systemseitig offen: POST /webhook (Adyen — per HMAC gesichert)
    // und GET / (Health). ALLES andere — auch GET /bookings (personenbezogene
    // Daten + die IDs, die man für Angriffe auf andere Endpoints bräuchte) —
    // verlangt PAYMENT_WORKER_API_KEY. Der Key wird serverseitig injiziert:
    // vom Pages-Function-Proxy (Staff hinter CF Access) bzw. von westendOS-
    // Server-Calls. NIE im Browser. Der Cron läuft in scheduled() und berührt
    // dieses Gate nicht.
    const isOpenPath =
      (method === "POST" && path === "/session") ||   // Gast-Tokenisierung (pay.html)
      (method === "POST" && path === "/webhook") ||   // Adyen — per HMAC gesichert
      (method === "GET"  && path === "/");            // Health-Check
    // GRACE-WINDOW: die drei Alt-PMS-Routen akzeptieren übergangsweise auch den
    // alten X-PMS-API-Key (PMS-Worker-Umstellung als Folgeschritt).
    const isGraceRoute =
      (method === "POST" && (path === "/charge-amount" || path === "/payment-link")) ||
      (method === "GET"  && path.startsWith("/booking-token/"));
    const authorized =
      authenticateCaller(request, env) === "westendos" ||
      (isGraceRoute && legacyPmsAuthValid(request, env));
    if (!isOpenPath && !authorized) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", hint: "Server-Key erforderlich (Zugriff nur über Proxy/Server)" }),
        { status: 401, headers: { ...CORS_HEADERS, "Access-Control-Allow-Origin": allowOrigin, "Vary": "Origin", "Content-Type": "application/json" } }
      );
    }

    try {
      const response = await (async () => {
      if (method === "POST" && path === "/session") return handleCreateSession(request, env);
      if (method === "POST" && path === "/charge") return handleCharge(request, env);
      if (method === "POST" && path === "/charge-amount") return handleChargeAmount(request, env);
      if (method === "POST" && path === "/payment-link") return handlePaymentLink(request, env);
      if (method === "POST" && path === "/webhook") return handleWebhook(request, env);
      if (method === "POST" && path === "/bookings/from-offer") return handleCreateFromOffer(request, env);
      if (method === "GET" && path === "/bookings") return handleGetBookings(env, url);

      const tokenMatch = path.match(/^\/booking-token\/([^/]+)$/);
      if (tokenMatch && method === "GET") {
        return handleBookingToken(tokenMatch[1], request, env);
      }

      const bookingMatch = path.match(/^\/bookings\/([^/]+)$/);
      if (bookingMatch) {
        const bookingId = bookingMatch[1];
        if (method === "GET") return handleGetBooking(bookingId, env);
        if (method === "PUT") return handleUpdateBooking(bookingId, request, env);
        if (method === "DELETE") return handleCancelBooking(bookingId, env);
      }

      const refundMatch = path.match(/^\/bookings\/([^/]+)\/refund$/);
      if (refundMatch && method === "POST") {
        return handleRefund(refundMatch[1], request, env);
      }

      const remindMatch = path.match(/^\/bookings\/([^/]+)\/remind$/);
      if (remindMatch && method === "POST") {
        return handleSendReminder(remindMatch[1], env);
      }

      if (method === "GET" && path === "/") {
        return jsonResponse({
          service: "westend-payment-worker",
          environment: "LIVE",
          status: "ok",
          version: "2.5.0",
          backend: "D1",
          adyen: "LIVE",
          timestamp: new Date().toISOString(),
        });
      }

      return errorResponse("Route nicht gefunden", 404);
      })();
      // v2.5.0: CORS-Origin am Boundary einschränken (statt "*") — Gast-Origin
      // wird reflektiert, alles andere ist same-origin/server (CORS irrelevant).
      try {
        response.headers.set("Access-Control-Allow-Origin", allowOrigin);
        response.headers.set("Vary", "Origin");
      } catch (_) { /* seltene immutable Response — ignorieren */ }
      return response;
    } catch (err) {
      console.error("Worker error:", err);
      return errorResponse(`Interner Fehler: ${err.message}`, 500);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduled(event, env));
  },
};