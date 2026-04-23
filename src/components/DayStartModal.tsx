'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/context/LanguageContext'

interface DayStartModalProps {
  name: string
  userId: string
  inspectionDone: boolean
  inspectionPath?: string
}

export function DayStartModal({ name, userId, inspectionDone, inspectionPath = '/driver/inspection' }: DayStartModalProps) {
  const router = useRouter()
  const { t } = useLanguage()
  const [visible, setVisible] = useState(false)

  const today = new Date().toISOString().split('T')[0]
  const storageKey = `day_modal_${userId}_${today}`

  useEffect(() => {
    if (inspectionDone) return
    if (typeof localStorage === 'undefined') return
    if (localStorage.getItem(storageKey)) return
    setVisible(true)
  }, [inspectionDone, storageKey])

  function dismiss() {
    localStorage.setItem(storageKey, '1')
    setVisible(false)
  }

  function startInspection() {
    localStorage.setItem(storageKey, '1')
    setVisible(false)
    router.push(inspectionPath)
  }

  if (!visible) return null

  const firstName = name.split(' ')[0]
  const hour = new Date().getHours()
  const greeting = hour < 12 ? t('greeting.morning') : hour < 17 ? t('greeting.afternoon') : t('greeting.evening')

  return (
    <div className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-5">
        <div className="text-center space-y-1">
          <p className="text-3xl">🚛</p>
          <h2 className="text-xl font-semibold text-gray-900">{greeting}, {firstName}!</h2>
          <p className="text-sm text-gray-500">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-800">{t('dayStart.preTrip')}</p>
          <p className="text-xs text-amber-600 mt-1">{t('dayStart.startDay')}</p>
        </div>

        <div className="space-y-2">
          <button
            onClick={startInspection}
            className="w-full py-3 bg-[#1a1a1a] text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors"
          >
            {t('dayStart.startButton')}
          </button>
          <button
            onClick={dismiss}
            className="w-full py-3 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            {t('dayStart.skip')}
          </button>
        </div>
      </div>
    </div>
  )
}
