'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, MapPin, PlusCircle, List, Fuel, Calendar } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

const allTabs = [
  { href: '/driver', label: 'Today', icon: Home, soloHidden: false },
  { href: '/driver/checkin', label: 'Check In', icon: MapPin, soloHidden: true },
  { href: '/driver/ticket', label: 'Ticket', icon: PlusCircle, soloHidden: false },
  { href: '/driver/fuel', label: 'Fuel', icon: Fuel, soloHidden: false },
  { href: '/driver/loads', label: 'Loads', icon: List, soloHidden: true },
  { href: '/driver/history', label: 'History', icon: Calendar, soloHidden: false },
]

export function BottomNav() {
  const pathname = usePathname()
  const { accountType } = useAuth()
  const tabs = accountType === 'solo' ? allTabs.filter(t => !t.soloHidden) : allTabs

  const isSolo = accountType === 'solo'

  return (
    <nav className={`fixed bottom-0 right-0 bg-white border-t border-gray-200 z-[1500] ${isSolo ? 'left-0 md:left-60' : 'left-0'}`}>
      <div className="flex">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = href === '/driver' ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center py-2 min-h-[56px] justify-center text-xs font-medium ${
                active ? 'text-[#1a1a1a]' : 'text-gray-400'
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
              <span className="mt-0.5">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
