'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, Send, FileText, Receipt, Building2, Settings, LogOut, Truck,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/drivers', label: 'Drivers', icon: Users },
  { href: '/dashboard/dispatch', label: 'Dispatch', icon: Send },
  { href: '/dashboard/tickets', label: 'Tickets', icon: FileText },
  { href: '/dashboard/invoices', label: 'Invoices', icon: Receipt },
  { href: '/dashboard/clients', label: 'Clients', icon: Building2 },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { profile, signOut } = useAuth()

  return (
    <aside className="w-60 flex-shrink-0 bg-[#1a1a1a] text-white flex flex-col h-screen fixed left-0 top-0">
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Truck size={20} className="text-white/70" />
          <span className="font-semibold text-base">HaulProof</span>
        </div>
        <p className="text-xs text-white/40 mt-1 truncate">{profile?.full_name ?? ''}</p>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === '/dashboard' ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors ${
                active ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs font-medium">
            {profile?.full_name?.charAt(0) ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{profile?.full_name}</p>
            <p className="text-xs text-white/40 capitalize">{profile?.role}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-3 w-full px-3 py-2 rounded text-sm text-white/60 hover:text-white hover:bg-white/10"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
