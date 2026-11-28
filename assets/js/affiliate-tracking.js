/* Read for Speed — affiliate referral tracking
   Captures a referral code, stores attribution for 30 days, and registers
   the referral with the Supabase Edge Function. Payment verification and
   commission creation must happen separately through trusted gateway webhooks.
*/
(function () {
  "use strict";

  const STORAGE_KEY = "rfs_affiliate_attribution_v1";
  const REFERRAL_PATTERN = /^[A-Z0-9_-]{3,32}$/;
  const ATTRIBUTION_DAYS = 30;
  const AFFILIATE_API_URL =
    "https://rthbcclfadbdkauapsck.supabase.co/functions/v1/affiliate-api";
  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_AVXVLCEc53CwwG4LH3qS_A_mJGEDYQJ";

  function readStoredAttribution() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;

      const data = JSON.parse(raw);
      const capturedAt = Number(data.capturedAt);
      const isFresh = Number.isFinite(capturedAt) &&
        Date.now() - capturedAt <= ATTRIBUTION_DAYS * 24 * 60 * 60 * 1000;

      if (
        !isFresh ||
        !REFERRAL_PATTERN.test(String(data.code || "")) ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          String(data.referralId || "")
        )
      ) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }

      return data;
    } catch (error) {
      return null;
    }
  }

  async function registerReferral(data) {
    if (!data || data.registered === true || data.registering === true) return;

    data.registering = true;

    try {
      const response = await fetch(AFFILIATE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_PUBLISHABLE_KEY
        },
        body: JSON.stringify({
          influencer_code: data.code,
          referral_id: data.referralId,
          landing_page: window.location.pathname
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Referral registration failed");
      }

      data.registered = true;
      data.registering = false;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      data.registering = false;
      console.warn("Read for Speed referral registration will retry:", error);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (_) {}
    }
  }

  function captureReferralFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const incomingCode = (params.get("ref") || "").trim().toUpperCase();

    if (!REFERRAL_PATTERN.test(incomingCode)) return;

    if (!window.crypto || typeof window.crypto.randomUUID !== "function") {
      console.warn("This browser cannot generate a secure referral ID.");
      return;
    }

    // Last valid referral click wins.
    const attribution = {
      code: incomingCode,
      referralId: window.crypto.randomUUID(),
      capturedAt: Date.now(),
      registered: false,
      registering: false
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(attribution));
    } catch (error) {
      console.warn("Could not save referral attribution:", error);
    }
  }

  captureReferralFromUrl();

  const savedAttribution = readStoredAttribution();
  if (savedAttribution && savedAttribution.registered !== true) {
    registerReferral(savedAttribution);
  }

  window.getRfsAffiliateAttribution = function () {
    const attribution = readStoredAttribution();
    if (!attribution) return {};

    return {
      influencer_code: attribution.code,
      referral_id: attribution.referralId
    };
  };
})();
