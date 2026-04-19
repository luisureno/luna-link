'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, MapPin, PlusCircle, List, Fuel, Calendar } from 'lucide-react'

const tabs = [
  { href: '/driver', label: 'Today', icon: Home },
  { href: '/driver/checkin', label: 'Check In', icon: MapPin },
  { href: '/driver/ticket', label: 'Ticket', icon: PlusCircle },
  { href: '/driver/fuel', label: 'Fuel', icon: Fuel },
  { href: '/driver/loads', label: 'Loads', icon: List },
  { href: '/driver/history', label: 'History', icon: Calendar },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-10">
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
