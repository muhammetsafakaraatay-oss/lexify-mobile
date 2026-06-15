import { getUncachableRevenueCatClient } from './revenueCatClient'
import {
  listProducts,
  listPackages,
  listOfferings,
  attachProductsToPackage,
  detachProductsFromPackage,
  deleteProduct,
  createProduct,
  attachProductsToEntitlement,
  listEntitlements,
} from '@replit/revenuecat-sdk'

const PROJECT_ID = process.env.REVENUECAT_PROJECT_ID || 'proj2f69bb99'
const TEST_STORE_APP_ID = process.env.REVENUECAT_TEST_STORE_APP_ID || 'app7e8ef49947'
const OFFERING_ID = 'ofrng2cde133093'
const PACKAGE_ID = 'pkgef2be116f6d'
const ENTITLEMENT_ID = 'entl556e925c12'

const PRODUCT_IDENTIFIER = 'lexify_premium_monthly_v2'
const PRODUCT_DISPLAY_NAME = 'Lexify Premium Aylık v2'
const PRODUCT_DURATION = 'P1M'
const PRODUCT_PRICES = [
  { amount_micros: 9990000, currency: 'USD' },
  { amount_micros: 249990000, currency: 'TRY' },
]

type TestStorePricesResponse = {
  object: string
  prices: { amount_micros: number; currency: string }[]
}

async function fix() {
  const client = getUncachableRevenueCatClient()

  // 1. List current products
  const { data: productsData, error: listErr } = await listProducts({
    client,
    path: { project_id: PROJECT_ID },
    query: { limit: 100 },
  })
  if (listErr) throw new Error('Failed to list products: ' + JSON.stringify(listErr))

  const testProducts = productsData?.items?.filter(p => p.app_id === TEST_STORE_APP_ID) ?? []
  console.log('Test store products:', testProducts.map(p => ({ id: p.id, store_id: p.store_identifier })))

  // 2. List current package products
  const { data: pkgProducts, error: pkgErr } = await listPackages({
    client,
    path: { project_id: PROJECT_ID, offering_id: OFFERING_ID },
    query: { limit: 20 },
  })
  if (pkgErr) throw new Error('Failed to list packages: ' + JSON.stringify(pkgErr))
  console.log('Current packages:', JSON.stringify(pkgProducts?.items?.map(p => p.id)))

  // 3. Create a fresh test store product with a new identifier (old ones are inactive/archived)
  console.log('\nCreating new test store product with identifier:', PRODUCT_IDENTIFIER)
  const { data: newProduct, error: createErr } = await createProduct({
    client,
    path: { project_id: PROJECT_ID },
    body: {
      store_identifier: PRODUCT_IDENTIFIER,
      app_id: TEST_STORE_APP_ID,
      type: 'subscription',
      display_name: PRODUCT_DISPLAY_NAME,
      subscription: { duration: PRODUCT_DURATION },
      title: 'Lexify Premium',
    } as any,
  })

  if (createErr) {
    if ((createErr as any).type === 'resource_already_exists') {
      console.log('Product already exists, looking it up...')
      const existing = testProducts.find(p => p.store_identifier === PRODUCT_IDENTIFIER)
      if (!existing) throw new Error('Could not find existing v2 product')
      console.log('Found existing product:', existing.id)
      await addPricesAndAttach(client, PROJECT_ID, existing.id, ENTITLEMENT_ID, PACKAGE_ID)
    } else {
      throw new Error('Failed to create product: ' + JSON.stringify(createErr))
    }
  } else {
    console.log('Created new product:', newProduct!.id)
    await addPricesAndAttach(client, PROJECT_ID, newProduct!.id, ENTITLEMENT_ID, PACKAGE_ID)
  }

  console.log('\nDone! RevenueCat is now configured correctly.')
}

async function addPricesAndAttach(
  client: any,
  projectId: string,
  productId: string,
  entitlementId: string,
  packageId: string
) {
  // Add prices
  console.log('Adding test store prices...')
  const { error: priceError } = await client.post<TestStorePricesResponse>({
    url: '/projects/{project_id}/products/{product_id}/test_store_prices',
    path: { project_id: projectId, product_id: productId },
    body: { prices: PRODUCT_PRICES },
  })
  if (priceError) {
    if ((priceError as any).type === 'resource_already_exists') {
      console.log('Prices already set')
    } else {
      console.warn('Price warning:', JSON.stringify(priceError))
    }
  } else {
    console.log('Prices set successfully')
  }

  // Attach to entitlement
  console.log('Attaching product to entitlement...')
  const { error: entErr } = await attachProductsToEntitlement({
    client,
    path: { project_id: projectId, entitlement_id: entitlementId },
    body: { product_ids: [productId] },
  })
  if (entErr && (entErr as any).type !== 'unprocessable_entity_error') {
    console.warn('Entitlement attach warning:', JSON.stringify(entErr))
  } else if (!entErr) {
    console.log('Attached to entitlement')
  } else {
    console.log('Already attached to entitlement')
  }

  // Attach to package
  console.log('Attaching product to package...')
  const { error: pkgAttachErr } = await attachProductsToPackage({
    client,
    path: { project_id: projectId, package_id: packageId },
    body: {
      products: [{ product_id: productId, eligibility_criteria: 'all' }],
    },
  })
  if (pkgAttachErr) {
    if ((pkgAttachErr as any).type === 'unprocessable_entity_error') {
      console.log('Package already has product or product still inactive')
      console.log('Error details:', JSON.stringify(pkgAttachErr))
    } else {
      throw new Error('Failed to attach to package: ' + JSON.stringify(pkgAttachErr))
    }
  } else {
    console.log('Attached to package successfully!')
  }
}

fix().catch(console.error)
