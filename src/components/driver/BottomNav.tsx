'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Calendar, Settings } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/context/LanguageContext'

export function BottomNav() {
  const pathname = usePathname()
  const { accountType } = useAuth()
  const { t } = useLanguage()
  const isSolo = accountType === 'solo'

  const tabs = [
    { href: '/driver', label: t('nav.today'), icon: Home },
    { href: '/driver/history', label: t('nav.history'), icon: Calendar },
    { href: '/driver/settings', label: t('nav.settings'), icon: Settings },
  ]

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
                active ? 'text-[#0bb89a]' : 'text-gray-400'
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
