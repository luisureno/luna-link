'use client'

import { usePullToRefresh } from '@/hooks/usePullToRefresh'

interface Props {
  onRefresh: () => Promise<void> | void
  children: React.ReactNode
}

export function PullToRefresh({ onRefresh, children }: Props) {
  const { pulling, refreshing, pullY } = usePullToRefresh(onRefresh)

  const visible = pulling || refreshing
  const progress = Math.min(pullY / 43, 1) // 0–1

  return (
    <>
      {/* Indicator */}
      <div
        className="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none transition-all"
        style={{
          transform: `translateY(${visible ? pullY - 12 : -48}px)`,
          transition: pulling ? 'none' : 'transform 0.3s ease',
        }}
      >
        <div className={`w-9 h-9 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center transition-opacity ${visible ? 'opacity-100' : 'opacity-0'}`}>
          {refreshing ? (
            <span className="w-4 h-4 border-2 border-gray-400 border-t-gray-900 rounded-full animate-spin" />
          ) : (
            <svg
              width="16" height="16" viewBox="0 0 16 16" fill="none"
              style={{ transform: `rotate(${progress * 360}deg)`, transition: pulling ? 'none' : 'transform 0.2s' }}
            >
              <path d="M8 2v4M8 2L6 4M8 2l2 2" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M13.5 8A5.5 5.5 0 1 1 8 2.5" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          )}
        </div>
      </div>

      {/* Page content pushed down while pulling */}
      <div
        style={{
          transform: `translateY(${visible ? pullY * 0.3 : 0}px)`,
          transition: pulling ? 'none' : 'transform 0.3s ease',
        }}
      >
        {children}
      </div>
    </>
  )
}
