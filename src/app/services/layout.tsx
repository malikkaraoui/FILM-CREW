import { redirectToPublicHomeIfNeeded } from '@/lib/public-front'

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  redirectToPublicHomeIfNeeded()
  return children
}
