import { redirectToPublicHomeIfNeeded } from '@/lib/public-front'

export default function ChainsLayout({ children }: { children: React.ReactNode }) {
  redirectToPublicHomeIfNeeded()
  return children
}
