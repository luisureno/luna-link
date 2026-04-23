'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'

export function Lightbox({ src, onClose }: { src: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!src) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [src, onClose])

  if (!src) return null

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        aria-label="Close"
      >
        <X size={22} />
      </button>
      <img
        src={src}
        alt=""
        className="max-w-full max-h-full object-contain rounded"
        onClick={e => e.stopPropagation()}
      />
    </div>
  )
}
