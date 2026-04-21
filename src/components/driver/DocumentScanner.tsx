'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Circle } from 'lucide-react'

interface DocumentScannerProps {
  onCapture: (file: File) => void
  onCancel: () => void
}

export function DocumentScanner({ onCapture, onCancel }: DocumentScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [ready, setReady] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [flashActive, setFlashActive] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function startCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        })
        if (cancelled) {
          mediaStream.getTracks().forEach(t => t.stop())
          return
        }
        streamRef.current = mediaStream
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
          videoRef.current.onloadedmetadata = () => {
            if (!cancelled) setReady(true)
          }
        }
      } catch {
        // Camera unavailable — fall back silently
        if (!cancelled) onCancel()
      }
    }

    startCamera()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  function capture() {
    if (!videoRef.current || !canvasRef.current || capturing) return
    setCapturing(true)
    setFlashActive(true)
    setTimeout(() => setFlashActive(false), 120)

    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0)

    canvas.toBlob(blob => {
      if (!blob) { setCapturing(false); return }
      streamRef.current?.getTracks().forEach(t => t.stop())
      const file = new File([blob], `scan_${Date.now()}.jpg`, { type: 'image/jpeg' })
      onCapture(file)
    }, 'image/jpeg', 0.94)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Flash overlay */}
      {flashActive && <div className="absolute inset-0 z-10 bg-white pointer-events-none" />}

      {/* Camera preview */}
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Dark vignette outside document frame */}
        {ready && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {/* Semi-transparent mask outside the scan area */}
            <div className="absolute inset-0 bg-black/40" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, 10% 12%, 10% 85%, 90% 85%, 90% 12%, 10% 12%)' }} />

            {/* Document frame box */}
            <div className="relative" style={{ width: '80%', height: '60%' }}>
              {/* Corner brackets — top-left */}
              <div className="animate-corner-pulse absolute top-0 left-0">
                <div className="absolute top-0 left-0 w-8 h-1 bg-blue-400 rounded-full" />
                <div className="absolute top-0 left-0 w-1 h-8 bg-blue-400 rounded-full" />
              </div>
              {/* Corner brackets — top-right */}
              <div className="animate-corner-pulse absolute top-0 right-0">
                <div className="absolute top-0 right-0 w-8 h-1 bg-blue-400 rounded-full" />
                <div className="absolute top-0 right-0 w-1 h-8 bg-blue-400 rounded-full" />
              </div>
              {/* Corner brackets — bottom-left */}
              <div className="animate-corner-pulse absolute bottom-0 left-0">
                <div className="absolute bottom-0 left-0 w-8 h-1 bg-blue-400 rounded-full" />
                <div className="absolute bottom-0 left-0 w-1 h-8 bg-blue-400 rounded-full" />
              </div>
              {/* Corner brackets — bottom-right */}
              <div className="animate-corner-pulse absolute bottom-0 right-0">
                <div className="absolute bottom-0 right-0 w-8 h-1 bg-blue-400 rounded-full" />
                <div className="absolute bottom-0 right-0 w-1 h-8 bg-blue-400 rounded-full" />
              </div>

              {/* Scanning line */}
              <div
                className="animate-scan-line absolute left-0 right-0 pointer-events-none"
                style={{ height: 2, background: 'linear-gradient(to right, transparent, #60a5fa, #3b82f6, #60a5fa, transparent)' }}
              />

              {/* Blue tint inside frame */}
              <div className="absolute inset-0 border border-blue-400/40 rounded-sm" style={{ background: 'rgba(59,130,246,0.04)' }} />
            </div>
          </div>
        )}

        {/* Instruction label */}
        <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none">
          <span className="text-white text-sm bg-black/60 px-4 py-1.5 rounded-full">
            Align invoice within the frame
          </span>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="bg-black h-28 flex items-center justify-between px-10 flex-shrink-0">
        {/* Cancel */}
        <button onClick={onCancel} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10">
          <X size={20} className="text-white" />
        </button>

        {/* Shutter */}
        <button
          onClick={capture}
          disabled={!ready || capturing}
          className="w-[70px] h-[70px] rounded-full bg-white disabled:opacity-50 flex items-center justify-center border-4 border-gray-400 active:scale-95 transition-transform"
        >
          <div className="w-14 h-14 rounded-full bg-white" />
        </button>

        {/* Spacer */}
        <div className="w-10" />
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
