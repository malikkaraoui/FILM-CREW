'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const nav = [
  { href: '/', label: 'Tableau de bord' },
  { href: '/chains', label: 'Chaînes' },
  { href: '/runs', label: 'Runs' },
  { href: '/viral', label: 'Viral' },
  { href: '/services', label: 'Services' },
  { href: '/settings', label: 'Réglages' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex w-48 shrink-0 flex-col border-r bg-background">
      <nav className="flex flex-col gap-1 p-2">
        {nav.map((item) => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
