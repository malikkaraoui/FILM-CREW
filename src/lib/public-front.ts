import { redirect } from 'next/navigation'

const TRUTHY_VALUES = new Set(['1', 'true', 'yes', 'on', 'public'])

export function isPublicFrontMode() {
  const raw = (process.env.PUBLIC_FRONT_MODE || '').trim().toLowerCase()
  return TRUTHY_VALUES.has(raw)
}

export function redirectToPublicHomeIfNeeded() {
  if (isPublicFrontMode()) {
    redirect('/')
  }
}
