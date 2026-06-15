import { getUncachableRevenueCatClient } from './revenueCatClient'
import { listPackages, getProductsFromPackage, getProductStoreState } from '@replit/revenuecat-sdk'

const PROJECT_ID = 'proj2f69bb99'
const OFFERING_ID = 'ofrng2cde133093'

async function diag() {
  const client = getUncachableRevenueCatClient()

  const { data: packages } = await listPackages({
    client,
    path: { project_id: PROJECT_ID, offering_id: OFFERING_ID },
    query: { limit: 20 },
  })

  console.log('Packages in offering:')
  for (const pkg of packages?.items ?? []) {
    console.log(`  - ${pkg.id} (${pkg.lookup_key}) "${pkg.display_name}"`)

    const { data: products, error } = await getProductsFromPackage({
      client,
      path: { project_id: PROJECT_ID, package_id: pkg.id },
      query: { limit: 20 },
    })

    if (error) {
      console.log('    Error getting products:', JSON.stringify(error))
      continue
    }

    for (const prod of products?.items ?? []) {
      let stateInfo = ''
      try {
        const { data: state } = await getProductStoreState({
          client,
          path: { project_id: PROJECT_ID, product_id: (prod as any).id },
        })
        stateInfo = JSON.stringify(state)
      } catch (e) {
        stateInfo = 'N/A'
      }
      console.log(`    Product: ${(prod as any).id} store_id=${(prod as any).store_identifier} state=${stateInfo}`)
    }
  }
}

diag().catch(console.error)
