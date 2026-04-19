import { Sidebar } from '@/components/dispatcher/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-screen">
      <Sidebar />
      <main className="flex-1 md:ml-60 p-4 md:p-6 pt-[72px] md:pt-6 min-h-screen bg-[#F8F7F5]">
        {children}
      </main>
    </div>
  )
}
