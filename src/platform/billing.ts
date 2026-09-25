// In-app purchases through Google Play Billing (Android only).
// NOTE: purchases are trusted on the device. For a larger game, verify purchase tokens on a server.
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';
import { isNative } from './ads';
import { PRODUCTS, type ProductId } from './config';

const prices: Partial<Record<ProductId, string>> = {};

export const billingAvailable = isNative;

export async function loadPrices(): Promise<void> {
  if (!isNative) return;
  try {
    const { isBillingSupported } = await NativePurchases.isBillingSupported();
    if (!isBillingSupported) return;
    const { products } = await NativePurchases.getProducts({ productIdentifiers: PRODUCTS.map((p) => p.id), productType: PURCHASE_TYPE.INAPP });
    for (const p of products) prices[p.identifier as ProductId] = p.priceString;
  } catch (e) {
    console.warn('Could not load store prices', e);
  }
}

export function priceOf(id: ProductId): string {
  return prices[id] ?? PRODUCTS.find((p) => p.id === id)!.fallbackPrice;
}

/** Starts the Google Play purchase sheet; resolves true when the purchase went through. */
export async function purchase(id: ProductId): Promise<boolean> {
  if (!isNative) return import.meta.env.DEV; // dev builds simulate a successful purchase for testing
  const def = PRODUCTS.find((p) => p.id === id)!;
  try {
    await NativePurchases.purchaseProduct({ productIdentifier: id, productType: PURCHASE_TYPE.INAPP, isConsumable: def.consumable });
    return true;
  } catch (e) {
    console.warn('Purchase cancelled or failed', e);
    return false;
  }
}

/** One-time products the Google account already owns (for reinstalls / new phones). */
export async function ownedProducts(): Promise<ProductId[]> {
  if (!isNative) return [];
  try {
    const { purchases } = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.INAPP });
    return purchases.map((p) => p.productIdentifier as ProductId).filter((id) => !PRODUCTS.find((d) => d.id === id)?.consumable);
  } catch {
    return [];
  }
}
