---
name: RevenueCat Setup
description: RC project config, test store state, and iOS paywall fix details
---

## Project & Apps
- Project ID: `proj2f69bb99` (lookup_key: "lexfly")
- Test Store app: `app7e8ef49947` — public key: `test_uUdmAFrfYoyFYvTIwCVlwUsFtwp`
- App Store app: `appe18e928114` — public key: `appl_cBbyFxbEtRIadLvTBTHlIeSlUCG`
- Play Store app: `appc5353aaa91` — public key: `goog_guJMqKmKUcyTdsNhuVcElFZMKKZ`

## Entitlement
- ID: `entl556e925c12`, lookup_key: `premium`

## Offering & Packages (CURRENT STATE)
- Offering: `ofrng2cde133093` (lookup_key: `default`, is_current: true)
- Monthly package: `pkgef2be116f6d` ($rc_monthly)
  - Product: `prod1f586a7877` — `lexify_premium_monthly_v2` (test store, ₺249.99 / $9.99)
- Yearly package: `pkge02d1d27c64` ($rc_annual)
  - Product: `prode2b2408b81` — `lexify_premium_yearly_v2` (test store, ₺1,499.99 / $59.99)

**App Store products (`lexify_pro_monthly`, `lexify_pro_yearly`) were intentionally detached from packages** — they were blocking iOS test store purchases.

## Key Behavior
- `lib/revenuecat.tsx`: uses TEST key in __DEV__, web, and storeClient (Expo Go); iOS/Android keys in production
- iOS v1 REST API: returns 0 packages when App Store products are in the package (not published in App Store Connect)
- Android v1 REST API: returns test store products (works for dev testing)
- Web (purchases-js): always returns empty offerings — test store not supported; handled gracefully in paywall.tsx

## Root Cause of iOS Error (FIXED)
"Bu plan RevenueCat offering içinde bulunamadı..." was from RevenueCat test store native SDK trying to purchase App Store product `lexify_pro_monthly` in test store. Fix: detach App Store products, keep only test store products in packages.

**Why:** RevenueCat test store on iOS picks the App Store product if both are in the package, which then fails in test mode.

## Web Paywall Fix
When `!isLoading && !pkg` (empty offerings on web), paywall shows "Mobil Uygulamada Mevcut" card instead of disabled purchase UI.

## Env Vars (set in Replit secrets)
- `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
- `REVENUECAT_API_KEY` (server-side secret key, used in scripts)
- `REVENUECAT_PROJECT_ID=proj2f69bb99`
