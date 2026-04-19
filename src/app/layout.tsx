import type { Metadata } from 'next'
import Link from 'next/link'
import { Geist } from 'next/font/google'
import './globals.css'
import { Topbar } from '@/components/layout/topbar'
import { Sidebar } from '@/components/layout/sidebar'
import { RecoveryBanner } from '@/components/layout/recovery-banner'

const geist = Geist({
  variable: '--font-geist',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'FILM-CREW',
  description: 'Pipeline de production vidéo courte IA',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" className={`${geist.variable} h-full antialiased`}>
      <body className="flex h-full flex-col bg-background text-foreground">
        <Topbar />
        <RecoveryBanner />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <main className="flex-1 overflow-y-auto p-4">
              {children}
            </main>
            <footer className="border-t px-4 py-3 text-xs text-muted-foreground">
              <div className="flex flex-wrap items-center gap-3">
                <span>FILM-CREW</span>
                <Link href="/terms" className="hover:text-foreground">
                  Conditions d’utilisation
                </Link>
                <Link href="/privacy" className="hover:text-foreground">
                  Politique de confidentialité
                </Link>
              </div>
            </footer>
          </div>
        </div>
      </body>
    </html>
  )
}
