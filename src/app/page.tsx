import { DashboardHome } from '@/components/dashboard/dashboard-home'
import { PublicSiteHome } from '@/components/public/public-site-home'
import { isPublicFrontMode } from '@/lib/public-front'

export default function HomePage() {
  if (isPublicFrontMode()) {
    return <PublicSiteHome />
  }

  return <DashboardHome />
}
