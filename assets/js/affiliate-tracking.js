/* Read for Speed — affiliate referral capture
   This is the browser-side foundation only. Verified sales and commissions
   must be recorded by a trusted backend using Paddle/Razorpay webhooks.
*/
(function () {
  "use strict";

  const STORAGE_KEY = "rfs_affiliate_attribution_v1";
  const REFERRAL_PATTERN = /^[A-Z0-9_-]{3,32}$/;
  const ATTRIBUTION_DAYS = 30;

  function readStoredAttribution() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;

      const data = JSON.parse(raw);
      const capturedAt = Number(data.capturedAt);
      const isFresh = Number.isFinite(capturedAt) &&
        Date.now() - capturedAt <= ATTRIBUTION_DAYS * 24 * 60 * 60 * 1000;

      if (!isFresh || !REFERRAL_PATTERN.test(String(data.code || "")) ||
          !String(data.referralId || "")) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }

      return data;
    } catch (error) {
      return null;
    }
  }

  function captureReferralFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const incomingCode = (params.get("ref") || "").trim().toUpperCase();

    if (!REFERRAL_PATTERN.test(incomingCode)) return;

    // Last valid referral click wins; subsequent browsing keeps that attribution.
    const attribution = {
      code: incomingCode,
      referralId: (window.crypto && typeof window.crypto.randomUUID === "function")
        ? window.crypto.randomUUID()
        : "rfs-" + Date.now() + "-" + Math.random().toString(36).slice(2, 12),
      capturedAt: Date.now()
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(attribution));
    } catch (error) {
      // Checkout can still proceed if browser storage is unavailable.
    }
  }

  captureReferralFromUrl();

  window.getRfsAffiliateAttribution = function () {
    const attribution = readStoredAttribution();
    if (!attribution) return {};

    return {
      influencer_code: attribution.code,
      referral_id: attribution.referralId
    };
  };
})();