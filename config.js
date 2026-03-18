/**
 * westendhotel Booking Tool – Konfiguration
 * ═══════════════════════════════════════════
 * Diese Datei ist die EINZIGE Datei, die sich zwischen
 * main (LIVE) und staging (TEST) unterscheidet.
 *
 * LIVE-Version (main branch)
 */

const CONFIG = {
  env: 'live',
  workerURL: 'https://westend-payment-worker.dd-f19.workers.dev',
  brevoProxyURL: 'https://westend-brevo-proxy.dd-f19.workers.dev',
  adyenEnv: 'live',
  adyenSDK: 'https://checkoutshopper-live.adyen.com/checkoutshopper/sdk/5.65.0',
  payBaseURL: 'https://booking-hotelwestend.de/pay.html',
};
