import { useEffect, useRef, useState } from 'react'

const THRESHOLD = 72 // px to pull before releasing triggers refresh

export function usePullToRefresh(onRefresh: () => Promise<void> | void) {
  const [pulling, setPulling] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [pullY, setPullY] = useState(0)

  const startY = useRef(0)
  const isDragging = useRef(false)

  useEffect(() => {
    function canPull() {
      return window.scrollY === 0
    }

    function onTouchStart(e: TouchEvent) {
      if (!canPull()) return
      startY.current = e.touches[0].clientY
      isDragging.current = true
    }

    function onTouchMove(e: TouchEvent) {
      if (!isDragging.current) return
      if (window.scrollY > 0) { isDragging.current = false; return }

      const delta = e.touches[0].clientY - startY.current
      if (delta <= 0) { setPulling(false); setPullY(0); return }

      // Dampen the pull with logarithmic resistance
      const dampened = Math.min(THRESHOLD * 1.5, delta * 0.45)
      setPulling(true)
      setPullY(dampened)
    }

    async function onTouchEnd() {
      if (!isDragging.current) return
      isDragging.current = false

      if (pullY >= THRESHOLD * 0.45) {
        setRefreshing(true)
        setPullY(THRESHOLD * 0.6)
        try {
          await onRefresh()
        } finally {
          setRefreshing(false)
        }
      }

      setPulling(false)
      setPullY(0)
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('touchend', onTouchEnd)

    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [onRefresh, pullY])

  return { pulling, refreshing, pullY }
}
