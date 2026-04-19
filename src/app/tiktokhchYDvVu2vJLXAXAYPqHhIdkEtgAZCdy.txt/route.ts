import { NextResponse } from 'next/server'

const CONTENT = 'tiktok-developers-site-verification=hchYDvVu2vJLXAXAYPqHhIdkEtgAZCdy'

export async function GET() {
  return new NextResponse(`${CONTENT}\n`, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  })
}
