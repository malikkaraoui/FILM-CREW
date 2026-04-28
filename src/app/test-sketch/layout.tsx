import { redirectToPublicHomeIfNeeded } from '@/lib/public-front'

export default function TestSketchLayout({ children }: { children: React.ReactNode }) {
  redirectToPublicHomeIfNeeded()
  return children
}
