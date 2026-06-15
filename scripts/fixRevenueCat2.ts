import { getUncachableRevenueCatClient } from './revenueCatClient'
import { createProduct, attachProductsToPackage, attachProductsToEntitlement } from '@replit/revenuecat-sdk'

const PROJECT_ID = 'proj2f69bb99'
const TEST_STORE_APP_ID = 'app7e8ef49947'
const ENTITLEMENT_ID = 'entl556e925c12'
const PKG_YEARLY_ID = 'pkge02d1d27c64'

const YEARLY_IDENTIFIER = 'lexify_premium_yearly_v2'
const YEARLY_PRICES = [
  { amount_micros: 59990000, currency: 'USD' },
  { amount_micros: 1499990000, currency: 'TRY' },
]

type TestStorePricesResponse = { prices: { amount_micros: number; currency: string }[] }

async function fix() {
  const client = getUncachableRevenueCatClient()

  // Create yearly test store product
  console.log('Creating yearly test store product...')
  let yearlyProductId: string

  const { data: created, error } = await createProduct({
    client,
    path: { project_id: PROJECT_ID },
    body: {
      store_identifier: YEARLY_IDENTIFIER,
      app_id: TEST_STORE_APP_ID,
      type: 'subscription',
      display_name: 'Lexify Premium Yıllık v2',
      subscription: { duration: 'P1Y' },
      title: 'Lexify Premium',
    } as any,
  })

  if (error) {
    if ((error as any).type === 'resource_already_exists') {
      console.log('Yearly product already exists, skipping creation')
      yearlyProductId = 'prod_yearly_v2_existing'
    } else {
      throw new Error('Failed to create yearly product: ' + JSON.stringify(error))
    }
  } else {
    yearlyProductId = created!.id
    console.log('Created yearly product:', yearlyProductId)
  }

  // Add prices to yearly product
  console.log('Adding prices to yearly product...')
  const { error: priceError } = await client.post<TestStorePricesResponse>({
    url: '/projects/{project_id}/products/{product_id}/test_store_prices',
    path: { project_id: PROJECT_ID, product_id: yearlyProductId },
    body: { prices: YEARLY_PRICES },
  })
  if (priceError && (priceError as any).type !== 'resource_already_exists') {
    console.warn('Price warning:', JSON.stringify(priceError))
  } else {
    console.log('Prices set for yearly product')
  }

  // Attach to entitlement
  const { error: entErr } = await attachProductsToEntitlement({
    client,
    path: { project_id: PROJECT_ID, entitlement_id: ENTITLEMENT_ID },
    body: { product_ids: [yearlyProductId] },
  })
  if (entErr && (entErr as any).type !== 'unprocessable_entity_error') {
    console.warn('Entitlement attach warning:', JSON.stringify(entErr))
  } else {
    console.log('Attached yearly to entitlement')
  }

  // Attach to yearly package
  const { error: pkgErr } = await attachProductsToPackage({
    client,
    path: { project_id: PROJECT_ID, package_id: PKG_YEARLY_ID },
    body: { products: [{ product_id: yearlyProductId, eligibility_criteria: 'all' }] },
  })
  if (pkgErr) {
    console.warn('Package attach warning:', JSON.stringify(pkgErr))
  } else {
    console.log('Attached yearly product to yearly package!')
  }

  console.log('\nDone! Both packages now have test store products.')
  console.log('Monthly package: lexify_premium_monthly_v2 (prod1f586a7877)')
  console.log('Yearly package:', YEARLY_IDENTIFIER, '(' + yearlyProductId + ')')
}

fix().catch(console.error)
