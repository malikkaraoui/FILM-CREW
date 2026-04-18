'use client'

import { ThemeToggle } from './theme-toggle'

export function Topbar() {
  return (
    <header className="sticky top-0 z-50 flex h-12 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center gap-4">
        <span className="text-sm font-semibold">VIDEO_TIKTOK</span>
      </div>

      <div className="flex items-center gap-2">
        {/* Progression run + coûts + providers — Epic 2 & 3 */}
        <ThemeToggle />
      </div>
    </header>
  )
}
