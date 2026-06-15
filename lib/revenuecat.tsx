import React, { createContext, useContext, useEffect, useState } from 'react'
import { Platform } from 'react-native'
import Purchases, { CustomerInfo, PurchasesOfferings, PurchasesPackage } from 'react-native-purchases'
import Constants from 'expo-constants'

const REVENUECAT_TEST_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY
const REVENUECAT_IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
const REVENUECAT_ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY

export const REVENUECAT_ENTITLEMENT_IDENTIFIER = 'premium'

function getRevenueCatApiKey(): string {
  if (!REVENUECAT_TEST_API_KEY || !REVENUECAT_IOS_API_KEY || !REVENUECAT_ANDROID_API_KEY) {
    throw new Error('RevenueCat Public API Keys not found')
  }
  if (__DEV__ || Platform.OS === 'web' || Constants.executionEnvironment === 'storeClient') {
    return REVENUECAT_TEST_API_KEY
  }
  if (Platform.OS === 'ios') return REVENUECAT_IOS_API_KEY
  if (Platform.OS === 'android') return REVENUECAT_ANDROID_API_KEY
  return REVENUECAT_TEST_API_KEY
}

export function initializeRevenueCat() {
  const apiKey = getRevenueCatApiKey()
  Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG)
  Purchases.configure({ apiKey })
  console.log('RevenueCat configured')
}

interface SubscriptionContextValue {
  customerInfo: CustomerInfo | null
  offerings: PurchasesOfferings | null
  isSubscribed: boolean
  isLoading: boolean
  isPurchasing: boolean
  isRestoring: boolean
  purchase: (pkg: PurchasesPackage) => Promise<CustomerInfo>
  restore: () => Promise<CustomerInfo>
  refresh: () => Promise<void>
}

const Context = createContext<SubscriptionContextValue | null>(null)

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null)
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)

  async function load() {
    try {
      const [info, offs] = await Promise.all([
        Purchases.getCustomerInfo(),
        Purchases.getOfferings(),
      ])
      setCustomerInfo(info)
      setOfferings(offs)
    } catch (e) {
      console.warn('RevenueCat load error:', e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const isSubscribed =
    customerInfo?.entitlements.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER] !== undefined

  async function purchase(pkg: PurchasesPackage): Promise<CustomerInfo> {
    setIsPurchasing(true)
    try {
      const { customerInfo: info } = await Purchases.purchasePackage(pkg)
      setCustomerInfo(info)
      return info
    } finally {
      setIsPurchasing(false)
    }
  }

  async function restore(): Promise<CustomerInfo> {
    setIsRestoring(true)
    try {
      const info = await Purchases.restorePurchases()
      setCustomerInfo(info)
      return info
    } finally {
      setIsRestoring(false)
    }
  }

  async function refresh() {
    await load()
  }

  return (
    <Context.Provider value={{ customerInfo, offerings, isSubscribed, isLoading, isPurchasing, isRestoring, purchase, restore, refresh }}>
      {children}
    </Context.Provider>
  )
}

export function useSubscription() {
  const ctx = useContext(Context)
  if (!ctx) throw new Error('useSubscription must be used within a SubscriptionProvider')
  return ctx
}
