/**
 * westendhotel Booking Tool – Konfiguration
 * ═══════════════════════════════════════════
 * Diese Datei ist die EINZIGE Datei, die sich zwischen
 * main (LIVE) und staging (TEST) unterscheidet.
 *
 * STAGING-Version (staging branch)
 * → Wird auf staging als "config.js" hochgeladen (ersetzt die Live-Version)
 */

const CONFIG = {
  env: 'test',
  workerURL: 'https://westend-payment-worker-staging.dd-f19.workers.dev',
  brevoProxyURL: 'https://westend-brevo-proxy.dd-f19.workers.dev',
  adyenEnv: 'test',
  adyenSDK: 'https://checkoutshopper-test.adyen.com/checkoutshopper/sdk/5.65.0',
  payBaseURL: 'https://booking-hotelwestend.de/pay.html',
};
