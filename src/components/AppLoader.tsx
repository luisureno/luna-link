'use client'

import { useEffect, useState } from 'react'

export function AppLoader({ message = 'Loading…' }: { message?: string }) {
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 6000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6 text-center">
      <span className="w-8 h-8 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
      <p className="text-sm text-gray-500">{message}</p>
      {slow && (
        <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 max-w-xs w-full">
          <p className="text-sm font-semibold text-amber-800">Taking longer than usual</p>
          <p className="text-xs text-amber-600 mt-0.5">Please refresh the page to try again.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 w-full bg-amber-500 text-white text-sm font-semibold py-2 rounded-lg hover:bg-amber-600"
          >
            Refresh
          </button>
        </div>
      )}
    </div>
  )
}
