import { redirectToPublicHomeIfNeeded } from '@/lib/public-front'

export default function RunsLayout({ children }: { children: React.ReactNode }) {
  redirectToPublicHomeIfNeeded()
  return children
}
