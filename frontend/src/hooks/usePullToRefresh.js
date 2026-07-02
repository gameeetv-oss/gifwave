import { useRef, useState, useEffect } from 'react'

const THRESHOLD = 70
const MAX_PULL = 120

export function usePullToRefresh(scrollRef, onRefresh) {
  const startYRef = useRef(null)
  const pullingRef = useRef(false)
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    const useWindow = !scrollRef || !scrollRef.current
    const el = useWindow ? window : scrollRef.current
    const getScrollTop = () => useWindow
      ? (window.scrollY || document.documentElement.scrollTop || 0)
      : el.scrollTop

    function start(e) {
      if (refreshing) return
      if (getScrollTop() > 0) { startYRef.current = null; return }
      startYRef.current = e.touches[0].clientY
      pullingRef.current = false
    }
    function move(e) {
      if (refreshing || startYRef.current == null) return
      const dy = e.touches[0].clientY - startYRef.current
      if (dy <= 0) { setPull(0); pullingRef.current = false; return }
      if (getScrollTop() > 0) { setPull(0); pullingRef.current = false; startYRef.current = null; return }
      pullingRef.current = true
      const damped = Math.min(MAX_PULL, dy * 0.5)
      setPull(damped)
    }
    async function end() {
      if (refreshing) return
      const wasPulling = pullingRef.current
      const finalPull = pull
      startYRef.current = null
      pullingRef.current = false
      if (wasPulling && finalPull >= THRESHOLD) {
        setRefreshing(true)
        setPull(40)
        try { await onRefresh?.() } finally {
          setRefreshing(false)
          setPull(0)
        }
      } else {
        setPull(0)
      }
    }

    el.addEventListener('touchstart', start, { passive: true })
    el.addEventListener('touchmove', move, { passive: true })
    el.addEventListener('touchend', end)
    el.addEventListener('touchcancel', end)
    return () => {
      el.removeEventListener('touchstart', start)
      el.removeEventListener('touchmove', move)
      el.removeEventListener('touchend', end)
      el.removeEventListener('touchcancel', end)
    }
  }, [scrollRef, onRefresh, refreshing, pull])

  return { pull, refreshing }
}
