import { NextResponse } from 'next/server'
import { getRecentFailovers, clearDismissedFailovers } from '@/lib/providers/failover'

export async function GET() {
  return NextResponse.json({ data: getRecentFailovers() })
}

export async function DELETE() {
  clearDismissedFailovers()
  return NextResponse.json({ data: { cleared: true } })
}
