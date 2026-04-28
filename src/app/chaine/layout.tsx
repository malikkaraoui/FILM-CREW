import { redirectToPublicHomeIfNeeded } from '@/lib/public-front'

export default function ChaineLayout({ children }: { children: React.ReactNode }) {
  redirectToPublicHomeIfNeeded()
  return children
}
