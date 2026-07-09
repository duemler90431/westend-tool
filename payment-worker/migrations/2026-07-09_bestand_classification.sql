-- westend-payment-worker · DB westend-bookings (LIVE) · 09.07.2026
-- Bestandsklassifizierung v2 — ERSETZT 2026-07-08_bestand_classification.sql (nur Feuerstein+Tests).
-- Grundlage: Lese-Query 09.07.2026 — 18 tokenisierbare Zukunftsfälle (kein Token, charge_date>=heute).
-- Entscheidung (verifiziert): 12 Survivor → guarantee/NULL; 6 offer_sent-Duplikate storniert; 2 Tests storniert.

-- ── 1) 6 offer_sent-Duplikate stornieren (Survivor werden NICHT berührt) ──
--    Guard status='offer_sent' schützt zusätzlich vor versehentlichem Treffer.
UPDATE bookings
  SET status='cancelled', cancelled_at=datetime('now'), updated_at=datetime('now')
  WHERE booking_id IN (
    'WH-2026-QNAO0K',  -- Frenzel   (Survivor: HVFB5R)
    'WH-2026-5GBM0Z',  -- Ebner     (Survivor: 49TPQ0)
    'WH-2026-J5BYH4',  -- Feuerstein 495€ ALT (Survivor: Z50UE6 489€)
    'WH-2026-ET9T8R',  -- Feuerstein 489€ offer (Survivor: Z50UE6)
    'WH-2026-UZ363F',  -- Otto      (Survivor: 4JP5KX)
    'WH-2026-HJ9FIX'   -- Otto      (Survivor: 4JP5KX)
  )
  AND status='offer_sent';

-- ── 2) 12 Survivor → purpose='guarantee', charge_date=NULL (Status unverändert) ──
UPDATE bookings
  SET purpose='guarantee', charge_date=NULL, updated_at=datetime('now')
  WHERE booking_id IN (
    'WH-2026-HVFB5R','WH-2026-49TPQ0','WH-2026-Z50UE6','WH-2026-4JP5KX',
    'WH-2026-P1OHFV','WH-2026-MKQ0X5','WH-2026-N9NUTE','WH-2026-JG7RV5',
    'WH-2026-QRUNU8','WH-2026-S6MMRZ','WH-2026-CPRUTP','WH-2026-8UR4T7'
  );

-- ── 3) 2 Test-Buchungen stornieren (charge_date in Vergangenheit) ──
UPDATE bookings
  SET status='cancelled', cancelled_at=datetime('now'), updated_at=datetime('now')
  WHERE booking_id IN ('WH-2026-0H6M3A','WH-2026-TEST01')
    AND status='pending_tokenization';
