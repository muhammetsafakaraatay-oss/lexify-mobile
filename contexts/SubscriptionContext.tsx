import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '../lib/supabase'
import {
  initSubscription,
  purchasePlan,
  refreshSubscription,
  restorePurchases,
  SubscriptionPackage,
  SubscriptionState,
} from '../lib/subscription'

interface SubscriptionContextValue extends SubscriptionState {
  refresh: () => Promise<void>
  purchase: (pkg: SubscriptionPackage) => Promise<{ ok: boolean; error?: string }>
  restore: () => Promise<{ ok: boolean; error?: string }>
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null)

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SubscriptionState>({
    isPro: false,
    isLoading: true,
    packages: [],
    expirationDate: null,
  })

  const bootstrap = useCallback(async (userId?: string | null) => {
    setState((s) => ({ ...s, isLoading: true }))
    const next = await initSubscription(userId)
    setState(next)
  }, [])

  useEffect(() => {
    bootstrap(null)

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await bootstrap(session?.user?.id ?? null)
    })

    return () => authSub.unsubscribe()
  }, [bootstrap])

  const refresh = useCallback(async () => {
    const { isPro, expirationDate } = await refreshSubscription()
    setState((s) => ({ ...s, isPro, expirationDate }))
  }, [])

  const purchase = useCallback(async (pkg: SubscriptionPackage) => {
    const result = await purchasePlan(pkg)
    if (result.isPro) {
      setState((s) => ({ ...s, isPro: true }))
      return { ok: true }
    }
    return { ok: false, error: result.error }
  }, [])

  const restore = useCallback(async () => {
    const result = await restorePurchases()
    if (result.isPro) {
      setState((s) => ({ ...s, isPro: true }))
      return { ok: true }
    }
    return { ok: false, error: result.error }
  }, [])

  const value = useMemo<SubscriptionContextValue>(
    () => ({ ...state, refresh, purchase, restore }),
    [state, refresh, purchase, restore],
  )

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext)
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider')
  return ctx
}

export function usePremium() {
  const { isPro, isLoading } = useSubscription()
  return { isPro, isLoading, isPremium: isPro }
}
