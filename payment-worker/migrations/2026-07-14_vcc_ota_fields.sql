-- westend-payment-worker · DB westend-bookings (LIVE) · 14.07.2026
-- Feature: vCC-Abrechnungsmodus für die MOTO-Seite (v2.6.0).
-- Additive Migration — reine Spalten-Ergänzung, kein Backfill, keine Zweckentfremdung
-- bestehender Felder. Beide Spalten nullable → Bestandsbuchungen bleiben unberührt.
--
--   ota_channel : Klartext-Kanal der vCC (z. B. 'Booking.com', 'Expedia', 'HRS',
--                 'Conferma', 'TravelPerk' oder Freitext bei 'Sonstige').
--   ota_ref     : Kanal-/OTA-Buchungsnummer wie auf der vCC ausgewiesen.
--   ota_note    : optionale interne Notiz aus dem vCC-Formular (eigene Spalte statt
--                 Zweckentfremdung eines Bestandsfeldes).
--
-- Genutzt von: POST /session (source='moto_vcc') zum Speichern; buildChargeReference()
-- baut aus channel+ref die Adyen-Reference {KANAL}-{otaRef}-{bookingId} (Abgleich/DATEV).
--
-- Idempotenz: D1/SQLite kann ADD COLUMN nicht "IF NOT EXISTS". Vor dem Anwenden prüfen:
--   npx wrangler d1 execute westend-bookings --remote \
--     --command "SELECT name FROM pragma_table_info('bookings') WHERE name IN ('ota_channel','ota_ref','ota_note')"
--   → liefert 0 Zeilen  ⇒  diese Migration anwenden.

ALTER TABLE bookings ADD COLUMN ota_channel TEXT;
ALTER TABLE bookings ADD COLUMN ota_ref TEXT;
ALTER TABLE bookings ADD COLUMN ota_note TEXT;
