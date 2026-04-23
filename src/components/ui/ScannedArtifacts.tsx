'use client'

import { useState } from 'react'
import { Lightbox } from '@/components/ui/Lightbox'

interface ScannedArtifactsProps {
  photos: { label: string; url: string }[]
  extracted?: Record<string, unknown> | null
}

export function ScannedArtifacts({ photos, extracted }: ScannedArtifactsProps) {
  const [lightbox, setLightbox] = useState<string | null>(null)
  const validPhotos = photos.filter(p => p.url)
  const hasExtracted = extracted && Object.keys(extracted).length > 0

  if (validPhotos.length === 0 && !hasExtracted) return null

  return (
    <div className="bg-white rounded-lg p-3 border border-gray-200 space-y-3">
      <p className="text-xs font-semibold text-gray-700">Scanned Documents</p>

      {validPhotos.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {validPhotos.map(p => (
            <div key={p.url}>
              <p className="text-xs text-gray-500 mb-1">{p.label}</p>
              <button
                type="button"
                onClick={() => setLightbox(p.url)}
                className="block w-full h-24 rounded border border-gray-200 overflow-hidden bg-gray-50 hover:border-gray-400 transition-colors"
              >
                <img src={p.url} alt={p.label} className="w-full h-full object-cover" />
              </button>
            </div>
          ))}
        </div>
      )}

      {hasExtracted && (
        <div>
          <p className="text-xs text-gray-500 mb-1">AI-extracted text</p>
          <div className="bg-gray-50 border border-gray-200 rounded p-2 text-xs text-gray-700 space-y-0.5 max-h-48 overflow-auto">
            {Object.entries(extracted!).map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="text-gray-400 font-medium min-w-[100px]">{k.replace(/_/g, ' ')}:</span>
                <span className="text-gray-800 break-words">{v == null || v === '' ? '—' : String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
    </div>
  )
}
