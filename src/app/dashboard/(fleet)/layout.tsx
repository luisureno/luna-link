import { Sidebar } from '@/components/dispatcher/Sidebar'
import { TrialBanner } from '@/components/TrialBanner'
import { TrialEndedGate } from '@/components/TrialEndedGate'
import { DemoBanner } from '@/components/DemoBanner'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-screen">
      <Sidebar />
      <main className="flex-1 md:ml-60 min-h-screen bg-[#F8F7F5] pt-[72px] md:pt-0">
        <DemoBanner />
        <TrialBanner billingHref="/dashboard/settings/billing" />
        <div className="p-4 md:p-6">{children}</div>
      </main>
      <TrialEndedGate billingHref="/dashboard/settings/billing" />
    </div>
  )
}
