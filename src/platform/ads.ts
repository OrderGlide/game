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
/** Last AdMob problem, shown in Settings so a failing ad can be diagnosed on the phone. */
let lastError = '';
const retryDelay = { rewarded: 30, interstitial: 30 };
const retrying = { rewarded: false, interstitial: false };
const loading = { rewarded: false, interstitial: false };

function describe(e: unknown): string {
  const o = (e ?? {}) as { code?: number | string; message?: string; errorMessage?: string };
  const code = o.code ?? '';
  // AdMob load error codes: 0 internal, 1 invalid request, 2 network, 3 no fill (no ad for now)
  const hint = { 0: 'internal', 1: 'invalid request', 2: 'network', 3: 'no fill' }[Number(code)] ?? '';
  return [code !== '' ? `#${code}` : '', hint, o.message ?? o.errorMessage ?? (typeof e === 'string' ? e : '')]
    .filter(Boolean).join(' ').slice(0, 120);
}

export async function initAds(): Promise<void> {
  if (!isNative || initialized) return;
  try {
    await AdMob.initialize({ initializeForTesting: ADMOB.testing });
    initialized = true;
  } catch (e) {
    lastError = `init: ${describe(e)}`;
    console.warn('AdMob init failed', e);
    return;
  }
  // EU/UK users must see Google's consent form before personalised ads. Its own try: a missing
  // consent message in the AdMob console must not stop the ads from loading.
  try {
    const info = await AdMob.requestConsentInfo();
    if (info.isConsentFormAvailable && info.status === AdmobConsentStatus.REQUIRED) await AdMob.showConsentForm();
  } catch (e) {
    lastError = `consent: ${describe(e)}`;
    console.warn('AdMob consent failed', e);
  }
  void preloadRewarded();
  void preloadInterstitial();
}

/** After a failed load try again later, waiting longer each time (30 s up to 5 min). */
function retry(kind: 'rewarded' | 'interstitial', load: () => Promise<void>): void {
  if (retrying[kind]) return;
  retrying[kind] = true;
  const d = retryDelay[kind];
  retryDelay[kind] = Math.min(d * 2, 300);
  setTimeout(() => { retrying[kind] = false; void load(); }, d * 1000);
}

async function preloadRewarded(): Promise<void> {
  if (loading.rewarded) return;
  loading.rewarded = true;
  try {
    await AdMob.prepareRewardVideoAd({ adId: ADMOB.rewarded, isTesting: ADMOB.testing });
    rewardedReady = true;
    retryDelay.rewarded = 30;
  } catch (e) {
    rewardedReady = false;
    lastError = `rewarded: ${describe(e)}`;
    retry('rewarded', preloadRewarded);
  } finally {
    loading.rewarded = false;
  }
}

async function preloadInterstitial(): Promise<void> {
  if (loading.interstitial) return;
  loading.interstitial = true;
  try {
    await AdMob.prepareInterstitial({ adId: ADMOB.interstitial, isTesting: ADMOB.testing });
    interstitialReady = true;
    retryDelay.interstitial = 30;
  } catch (e) {
    interstitialReady = false;
    lastError = `interstitial: ${describe(e)}`;
    retry('interstitial', preloadInterstitial);
  } finally {
    loading.interstitial = false;
  }
}

/** One line for Settings: whether ads are loaded, and the last error if any. */
export function adStatus(): string {
  if (!isNative) return 'web (test)';
  const state = `${ADMOB.testing ? 'TEST ' : ''}${initialized ? 'ok' : 'off'} · R ${rewardedReady ? '✓' : '…'} · I ${interstitialReady ? '✓' : '…'}`;
  return lastError ? `${state} · ${lastError}` : state;
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
  } catch (e) {
    lastError = `show: ${describe(e)}`;
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
  } catch (e) {
    lastError = `show: ${describe(e)}`;
  } finally {
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
