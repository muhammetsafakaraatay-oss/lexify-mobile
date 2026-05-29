import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type {
  CustomerInfo,
  PurchasesOfferings,
  PurchasesPackage,
} from 'react-native-purchases'
import { PRO_ENTITLEMENT_ID, SUBSCRIPTION_PRODUCTS } from './plan'

const DEV_PREMIUM_KEY = 'dev_premium_override_v1'

let purchasesConfigured = false

export type PlanPeriod = 'monthly' | 'yearly'

export interface SubscriptionPackage {
  id: PlanPeriod
  productId: string
  title: string
  priceString: string
  periodLabel: string
  badge?: string
  rcPackage?: PurchasesPackage
}

export interface SubscriptionState {
  isPro: boolean
  isLoading: boolean
  packages: SubscriptionPackage[]
  expirationDate: string | null
}

function getApiKey(): string | null {
  if (Platform.OS === 'web') return null
  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? null
  }
  if (Platform.OS === 'android') {
    return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? null
  }
  return null
}

async function getPurchasesModule() {
  return import('react-native-purchases')
}

async function ensurePurchasesReady(apiKey: string, userId?: string | null) {
  const { default: Purchases, LOG_LEVEL } = await getPurchasesModule()
  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG)
  }
  if (!purchasesConfigured) {
    Purchases.configure({ apiKey, appUserID: userId ?? undefined })
    purchasesConfigured = true
    return Purchases
  }
  if (userId) {
    try {
      await Purchases.logIn(userId)
    } catch (e) {
      console.warn('[subscription] logIn failed:', e)
    }
  }
  return Purchases
}

function hasActivePro(info: CustomerInfo | null): boolean {
  if (!info) return false
  const active = info.entitlements.active[PRO_ENTITLEMENT_ID]
  return !!active?.isActive
}

function fallbackPackages(): SubscriptionPackage[] {
  return [
    {
      id: 'yearly',
      productId: SUBSCRIPTION_PRODUCTS.yearly,
      title: 'Yıllık',
      priceString: '₺1.999,99',
      periodLabel: '/ yıl',
      badge: 'En iyi değer · 7 gün ücretsiz',
    },
    {
      id: 'monthly',
      productId: SUBSCRIPTION_PRODUCTS.monthly,
      title: 'Aylık',
      priceString: '₺249,99',
      periodLabel: '/ ay',
    },
  ]
}

function mapOfferings(offerings: PurchasesOfferings | null): SubscriptionPackage[] {
  const current = offerings?.current
  if (!current) return fallbackPackages()

  const mapped: SubscriptionPackage[] = []

  const yearly = current.annual ?? current.availablePackages.find(
    (p) => p.identifier.includes('annual') || p.product.identifier.includes('year'),
  )
  const monthly = current.monthly ?? current.availablePackages.find(
    (p) => p.identifier.includes('month') || p.product.identifier.includes('month'),
  )

  if (yearly) {
    mapped.push({
      id: 'yearly',
      productId: yearly.product.identifier,
      title: 'Yıllık',
      priceString: yearly.product.priceString,
      periodLabel: '/ yıl',
      badge: 'En iyi değer · 7 gün ücretsiz',
      rcPackage: yearly,
    })
  }

  if (monthly) {
    mapped.push({
      id: 'monthly',
      productId: monthly.product.identifier,
      title: 'Aylık',
      priceString: monthly.product.priceString,
      periodLabel: '/ ay',
      rcPackage: monthly,
    })
  }

  return mapped.length > 0 ? mapped : fallbackPackages()
}

async function devPremiumState(): Promise<Pick<SubscriptionState, 'isPro' | 'packages' | 'expirationDate'>> {
  const devPro = __DEV__ ? await AsyncStorage.getItem(DEV_PREMIUM_KEY) === 'true' : false
  return {
    isPro: devPro,
    packages: fallbackPackages(),
    expirationDate: null,
  }
}

export async function initSubscription(userId?: string | null): Promise<SubscriptionState> {
  const apiKey = getApiKey()

  if (!apiKey) {
    const dev = await devPremiumState()
    return { ...dev, isLoading: false }
  }

  try {
    const Purchases = await ensurePurchasesReady(apiKey, userId)

    const [offerings, info] = await Promise.all([
      Purchases.getOfferings(),
      Purchases.getCustomerInfo(),
    ])

    return {
      isPro: hasActivePro(info),
      isLoading: false,
      packages: mapOfferings(offerings),
      expirationDate: info.entitlements.active[PRO_ENTITLEMENT_ID]?.expirationDate ?? null,
    }
  } catch (e) {
    console.warn('[subscription] init failed:', e)
    const dev = await devPremiumState()
    return { ...dev, isPro: false, isLoading: false }
  }
}

export async function refreshSubscription(): Promise<Pick<SubscriptionState, 'isPro' | 'expirationDate'>> {
  const apiKey = getApiKey()
  if (!apiKey) {
    const dev = await devPremiumState()
    return { isPro: dev.isPro, expirationDate: dev.expirationDate }
  }

  try {
    const Purchases = await ensurePurchasesReady(apiKey)
    const info = await Purchases.getCustomerInfo()
    return {
      isPro: hasActivePro(info),
      expirationDate: info.entitlements.active[PRO_ENTITLEMENT_ID]?.expirationDate ?? null,
    }
  } catch (e) {
    console.warn('[subscription] refresh failed:', e)
    return { isPro: false, expirationDate: null }
  }
}

export async function purchasePlan(pkg: SubscriptionPackage): Promise<{ isPro: boolean; error?: string }> {
  const apiKey = getApiKey()
  if (!apiKey) {
    return { isPro: false, error: 'Satın alma henüz yapılandırılmadı. RevenueCat API anahtarını ekleyin.' }
  }

  if (!pkg.rcPackage) {
    return { isPro: false, error: 'Bu plan şu an mağazada bulunamadı.' }
  }

  try {
    const Purchases = await ensurePurchasesReady(apiKey)
    const { customerInfo } = await Purchases.purchasePackage(pkg.rcPackage)
    return { isPro: hasActivePro(customerInfo) }
  } catch (e: unknown) {
    const err = e as { userCancelled?: boolean; message?: string }
    if (err?.userCancelled) return { isPro: false }
    return { isPro: false, error: err?.message || 'Satın alma tamamlanamadı.' }
  }
}

export async function restorePurchases(): Promise<{ isPro: boolean; error?: string }> {
  const apiKey = getApiKey()
  if (!apiKey) {
    return { isPro: false, error: 'Geri yükleme için RevenueCat yapılandırması gerekli.' }
  }

  try {
    const Purchases = await ensurePurchasesReady(apiKey)
    const info = await Purchases.restorePurchases()
    const isPro = hasActivePro(info)
    if (!isPro) return { isPro: false, error: 'Aktif abonelik bulunamadı.' }
    return { isPro: true }
  } catch (e: unknown) {
    const err = e as { message?: string }
    return { isPro: false, error: err?.message || 'Geri yükleme başarısız.' }
  }
}

export async function setDevPremiumOverride(enabled: boolean): Promise<void> {
  if (!__DEV__) return
  await AsyncStorage.setItem(DEV_PREMIUM_KEY, enabled ? 'true' : 'false')
}

export async function getDevPremiumOverride(): Promise<boolean> {
  if (!__DEV__) return false
  return (await AsyncStorage.getItem(DEV_PREMIUM_KEY)) === 'true'
}

export function subscriptionConfigured(): boolean {
  return !!getApiKey()
}
