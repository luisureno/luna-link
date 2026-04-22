'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, Send, FileText, Receipt, Building2, Settings, LogOut, Truck, Menu, X, Clock, DollarSign, Home, List, Fuel,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

const fleetNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/drivers', label: 'Drivers', icon: Users },
  { href: '/dashboard/dispatch', label: 'Dispatch', icon: Send },
  { href: '/dashboard/tickets', label: 'Tickets', icon: FileText },
  { href: '/dashboard/timesheets', label: 'Timesheets', icon: Clock },
  { href: '/dashboard/fuel', label: 'Fuel', icon: Fuel },
  { href: '/dashboard/invoices', label: 'Invoices', icon: Receipt },
  { href: '/dashboard/payroll', label: 'Payroll', icon: DollarSign },
  { href: '/dashboard/clients', label: 'Clients', icon: Building2 },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

const soloNav = [
  { href: '/driver', label: 'Today', icon: Home },
  { href: '/dashboard/solo/loads', label: 'Loads', icon: List },
  { href: '/dashboard/solo/fuel', label: 'Fuel Map', icon: Fuel },
  { href: '/dashboard/solo/invoices', label: 'Invoices', icon: Receipt },
  { href: '/dashboard/solo/clients', label: 'Clients', icon: Building2 },
  { href: '/dashboard/solo/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { profile, accountType, signOut } = useAuth()
  const [open, setOpen] = useState(false)

  const navItems = accountType === 'solo' ? soloNav : fleetNav
  const homeHref = accountType === 'solo' ? '/driver' : '/dashboard'

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-[1500] bg-[#1a1a1a] text-white h-14 flex items-center justify-between px-4 border-b border-white/10">
        <Link href={homeHref} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <Truck size={18} className="text-white/70" />
          <span className="font-semibold text-sm">Fleetwise</span>
        </Link>
        <button onClick={() => setOpen(true)} className="p-2 -mr-2" aria-label="Open menu">
          <Menu size={20} />
        </button>
      </div>

      {/* Backdrop */}
      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-[1900]"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`w-60 flex-shrink-0 bg-[#1a1a1a] text-white flex flex-col h-screen fixed left-0 top-0 z-[2000] transition-transform md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-5 border-b border-white/10 flex items-start justify-between">
          <div>
            <Link href={homeHref} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <Truck size={20} className="text-white/70" />
              <span className="font-semibold text-base">Fleetwise</span>
            </Link>
            <p className="text-xs text-white/40 mt-1 truncate">
              {accountType === 'solo' ? ((profile as any)?.companies?.name ?? profile?.full_name ?? '') : (profile?.full_name ?? '')}
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="md:hidden p-1 -mr-1 text-white/60 hover:text-white"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = href === homeHref ? pathname === href : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
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
              <p className="text-sm font-medium truncate">
                {accountType === 'solo' ? ((profile as any)?.companies?.name ?? profile?.full_name) : profile?.full_name}
              </p>
              <p className="text-xs text-white/40 capitalize">
                {accountType === 'solo' ? profile?.full_name : profile?.role}
              </p>
            </div>
          </div>
          <a
            href="mailto:luisangelmureno@gmail.com?subject=fleetwise Support"
            className="flex items-center gap-3 w-full px-3 py-2 rounded text-sm text-white/60 hover:text-white hover:bg-white/10"
          >
            <span className="text-[14px]">💬</span>
            Contact Support
          </a>
          <button
            onClick={signOut}
            className="flex items-center gap-3 w-full px-3 py-2 rounded text-sm text-white/60 hover:text-white hover:bg-white/10"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>
    </>
  )
}
