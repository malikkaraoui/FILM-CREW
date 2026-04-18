import { NextResponse } from 'next/server'
import { estimateRunCost } from '@/lib/providers/cost-estimator'
import { getConfig } from '@/lib/db/queries/config'

export async function GET() {
  try {
    const estimate = await estimateRunCost()

    // Vérifier si le plafond mensuel serait dépassé
    const monthlyLimit = await getConfig('cost_limit_monthly')
    let warning: string | null = null
    if (monthlyLimit) {
      const limit = parseFloat(monthlyLimit)
      if (estimate.totalEur > limit) {
        warning = `Ce run dépasse le plafond mensuel configuré (${limit.toFixed(2)} €)`
      }
    }

    return NextResponse.json({ data: { ...estimate, warning } })
  } catch (e) {
    return NextResponse.json(
      { error: { code: 'ESTIMATE_ERROR', message: (e as Error).message } },
      { status: 500 },
    )
  }
}
