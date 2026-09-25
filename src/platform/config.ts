// Store and ad configuration. Replace the Google *test* IDs below with your own before release
// (AdMob console → Apps → your app / Ad units; Play Console → Monetize → Products → In-app products).
import type { Price, SkinId } from '../data';

export const ADMOB = {
  /** Also set in android/app/src/main/AndroidManifest.xml (com.google.android.gms.ads.APPLICATION_ID). */
  appId: 'ca-app-pub-3940256099942544~3347511713',
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
  /** Keep true until your own ad units are approved — clicking real ads on your own device can get the account banned. */
  testing: true,
};

/** Interstitials are rare on purpose: never in the first minutes, never back to back. */
export const INTERSTITIAL = { firstAfterSec: 300, minGapSec: 240, everyWaves: 3 };

/** Cooldowns for "watch an ad" rewards, in seconds. */
export const AD_COOLDOWN = { boost: 600, chest: 1800 };

export type ProductId = 'gems_small' | 'gems_medium' | 'gems_large' | 'starter_pack' | 'no_ads';
export interface ProductDef {
  id: ProductId;
  icon: string;
  consumable: boolean;
  grant: Price & { skin?: SkinId; noAds?: boolean };
  /** Shown until the real, localised price is loaded from Google Play. */
  fallbackPrice: string;
  best?: boolean;
}

export const PRODUCTS: ProductDef[] = [
  { id: 'starter_pack', icon: '🎁', consumable: false, grant: { em: 80, di: 20, ob: 5, skin: 'ice', noAds: false }, fallbackPrice: '9,99 zł', best: true },
  { id: 'gems_small', icon: '💚', consumable: true, grant: { em: 60, di: 10 }, fallbackPrice: '4,99 zł' },
  { id: 'gems_medium', icon: '💎', consumable: true, grant: { em: 200, di: 40, ob: 10 }, fallbackPrice: '19,99 zł' },
  { id: 'gems_large', icon: '👑', consumable: true, grant: { em: 600, di: 130, ob: 40 }, fallbackPrice: '49,99 zł' },
  { id: 'no_ads', icon: '🚫', consumable: false, grant: { noAds: true }, fallbackPrice: '14,99 zł' },
];
