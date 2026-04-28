import { redirectToPublicHomeIfNeeded } from '@/lib/public-front'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  redirectToPublicHomeIfNeeded()
  return children
}
