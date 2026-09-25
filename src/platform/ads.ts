// Ads: Google AdMob on Android, a clearly-labelled simulated ad in the browser build.
import { Capacitor } from '@capacitor/core';
import { AdMob, AdmobConsentStatus } from '@capacitor-community/admob';
import { ADMOB } from './config';
import { T } from '../i18n';

export const isNative = Capacitor.isNativePlatform();

let initialized = false;
let rewardedReady = false;
let interstitialReady = false;
let showing = false;

export async function initAds(): Promise<void> {
  if (!isNative || initialized) return;
  try {
    await AdMob.initialize({ initializeForTesting: ADMOB.testing });
    // EU/UK users must see Google's consent form before personalised ads
    const info = await AdMob.requestConsentInfo();
    if (info.isConsentFormAvailable && info.status === AdmobConsentStatus.REQUIRED) await AdMob.showConsentForm();
    initialized = true;
    void preloadRewarded();
    void preloadInterstitial();
  } catch (e) {
    console.warn('AdMob init failed', e);
  }
}

async function preloadRewarded(): Promise<void> {
  try {
    await AdMob.prepareRewardVideoAd({ adId: ADMOB.rewarded, isTesting: ADMOB.testing });
    rewardedReady = true;
  } catch { rewardedReady = false; }
}

async function preloadInterstitial(): Promise<void> {
  try {
    await AdMob.prepareInterstitial({ adId: ADMOB.interstitial, isTesting: ADMOB.testing });
    interstitialReady = true;
  } catch { interstitialReady = false; }
}

/** Shows a rewarded ad; resolves true only if the player earned the reward. */
export async function showRewarded(): Promise<boolean> {
  if (showing) return false;
  showing = true;
  try {
    if (!isNative) return await simulatedAd(true);
    if (!initialized) await initAds();
    if (!rewardedReady) await preloadRewarded();
    if (!rewardedReady) return false;
    rewardedReady = false;
    const reward = await AdMob.showRewardVideoAd();
    void preloadRewarded();
    return !!reward;
  } catch {
    void preloadRewarded();
    return false;
  } finally {
    showing = false;
  }
}

export async function showInterstitial(): Promise<void> {
  if (showing) return;
  showing = true;
  try {
    if (!isNative) { await simulatedAd(false); return; }
    if (!interstitialReady) return;
    interstitialReady = false;
    await AdMob.showInterstitial();
  } catch { /* no fill — just skip */ } finally {
    showing = false;
    if (isNative) void preloadInterstitial();
  }
}

/** Browser stand-in so the reward flows can be tried without a phone. */
function simulatedAd(rewarded: boolean): Promise<boolean> {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;z-index:50;background:#0d1424;color:#fff;display:flex;flex-direction:column;'
      + 'align-items:center;justify-content:center;gap:14px;font:800 20px system-ui,sans-serif;text-align:center;padding:24px;';
    el.innerHTML = `<div style="font-size:54px">📺</div><div>${T.adTest}</div>
      <div style="font-size:14px;color:#9fb0d6;max-width:300px">${T.adTestNote}</div><div data-c style="font-size:40px;color:#ffd23f">3</div>`;
    document.body.appendChild(el);
    let n = rewarded ? 3 : 2;
    const c = el.querySelector('[data-c]') as HTMLElement;
    c.textContent = String(n);
    const id = setInterval(() => {
      n--;
      c.textContent = String(n);
      if (n <= 0) { clearInterval(id); el.remove(); resolve(true); }
    }, 1000);
  });
}
