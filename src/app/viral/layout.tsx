import { redirectToPublicHomeIfNeeded } from '@/lib/public-front'

export default function ViralLayout({ children }: { children: React.ReactNode }) {
  redirectToPublicHomeIfNeeded()
  return children
}
