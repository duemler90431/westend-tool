-- westend-payment-worker · DB westend-bookings (LIVE)
-- Additive Migration 08.07.2026 — Zweck-Trennung, Reminder-Staffel, westendOS-Integration
-- Sicher via: wrangler d1 execute westend-bookings --remote --file=...  (fasst Worker/Bindings NICHT an)

-- 1) Karten-Zweck: 'charge_scheduled' (Cron belastet am charge_date) | 'guarantee' (nie automatisch)
ALTER TABLE bookings ADD COLUMN purpose TEXT;

-- 2) Reminder-Deckelung (max 2 Gast-Mails, danach nur intern)
ALTER TABLE bookings ADD COLUMN reminder_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN reminder_last_stage TEXT;   -- 'r1' | 'r2' | 'internal'

-- 3) westendOS-Integration: gesetzt von Server-Calls aus westendOS, null bei westend-tool
ALTER TABLE bookings ADD COLUMN reservation_id INTEGER;

-- 4) Bestands-Backfill (idempotent, safe):
--    a) bereits Erinnerte nicht erneut anmailen
UPDATE bookings SET reminder_count = 1 WHERE reminder_sent_at IS NOT NULL AND reminder_count = 0;
--    b) Zweck-Default für Alt-Token, damit der neue Cron-Guard sie NICHT belastet,
--       solange nicht manuell klassifiziert (NULL/guarantee = kein Auto-Charge).
--       (Keine Automatik-Belastung von Altbestand — bewusst konservativ.)
