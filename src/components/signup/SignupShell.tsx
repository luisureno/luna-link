import Link from 'next/link'
import { Truck, Check } from 'lucide-react'

const STEPS = [
  { n: 1, label: 'Plan' },
  { n: 2, label: 'Company' },
  { n: 3, label: 'Account' },
  { n: 4, label: 'Team' },
  { n: 5, label: 'Clients' },
  { n: 6, label: 'Done' },
]

export function SignupShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8F7F5] text-gray-900">
      <nav className="border-b border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Truck size={20} className="text-gray-900" />
            <span className="text-base md:text-lg font-semibold tracking-tight">FleetWise</span>
          </Link>
          <Link href="/login" className="text-sm font-medium text-gray-700 hover:text-gray-900">
            Log in
          </Link>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-4 md:px-6 py-10 md:py-16">{children}</main>
    </div>
  )
}

export function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-1 md:gap-2 mb-8 overflow-x-auto">
      {STEPS.map((s, i) => {
        const done = s.n < current
        const active = s.n === current
        return (
          <div key={s.n} className="flex items-center gap-1 md:gap-2 flex-shrink-0">
            <div
              className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                done
                  ? 'bg-[#1a1a1a] text-white'
                  : active
                  ? 'bg-[#1a1a1a] text-white ring-2 ring-gray-900/20 ring-offset-2'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {done ? <Check size={14} /> : s.n}
            </div>
            <span
              className={`text-[11px] md:text-xs font-medium hidden sm:inline ${
                active ? 'text-gray-900' : done ? 'text-gray-700' : 'text-gray-400'
              }`}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && <div className="w-3 md:w-6 h-px bg-gray-300" />}
          </div>
        )
      })}
    </div>
  )
}
