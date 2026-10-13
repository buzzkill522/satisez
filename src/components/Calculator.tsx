import { useEffect, useRef, useState } from 'react'

const DESMOS_URL = 'https://www.desmos.com/calculator'
const MARGIN = 12

/**
 * Desmos graphing calculator in a floating window on the same page, like Bluebook's.
 * Drag it by the title bar, resize from the corner, expand it, or close it. It stays mounted
 * once opened (just hidden when closed) so graphs survive closing and moving between questions.
 */
export function useCalculator() {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const toggle = () => {
    setMounted(true)
    setOpen((o) => !o)
  }
  const panel = mounted ? <CalculatorPanel open={open} onClose={() => setOpen(false)} /> : null
  return { open, toggle, panel }
}

function CalculatorPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [pos, setPos] = useState(() => ({ x: Math.max(MARGIN, window.innerWidth - 480 - 24), y: 80 }))
  const [expanded, setExpanded] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const drag = useRef<{ dx: number; dy: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  // Keep the window on screen when the browser is resized.
  useEffect(() => {
    const clamp = () => {
      const el = ref.current
      if (!el) return
      setPos((p) => ({
        x: Math.min(Math.max(MARGIN, p.x), Math.max(MARGIN, window.innerWidth - el.offsetWidth - MARGIN)),
        y: Math.min(Math.max(MARGIN, p.y), Math.max(MARGIN, window.innerHeight - 60)),
      }))
    }
    window.addEventListener('resize', clamp)
    return () => window.removeEventListener('resize', clamp)
  }, [])

  function onPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest('button, a')) return
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y }
    setDragging(true)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return
    const w = ref.current?.offsetWidth ?? 400
    setPos({
      x: Math.min(Math.max(MARGIN - w + 120, e.clientX - drag.current.dx), window.innerWidth - 120),
      y: Math.min(Math.max(0, e.clientY - drag.current.dy), window.innerHeight - 48),
    })
  }
  function onPointerUp() {
    drag.current = null
    setDragging(false)
  }

  return (
    <div
      ref={ref}
      className={`calc-panel ${expanded ? 'expanded' : ''} ${dragging ? 'dragging' : ''}`}
      style={{ left: pos.x, top: pos.y, display: open ? undefined : 'none' }}
      role="dialog"
      aria-label="Desmos graphing calculator"
    >
      <div className="calc-bar" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        <span className="calc-grip" aria-hidden="true">⠿</span>
        <b>Calculator</b>
        <span className="calc-spacer" />
        <a className="calc-btn calc-out" href={DESMOS_URL} target="_blank" rel="noreferrer" title="Open Desmos in a new tab (if it doesn't load here)" aria-label="Open Desmos in a new tab">↗</a>
        <button className="calc-btn" onClick={() => setExpanded((x) => !x)} aria-label={expanded ? 'Shrink calculator' : 'Expand calculator'} title={expanded ? 'Shrink' : 'Expand'}>
          {expanded ? '⤡' : '⤢'}
        </button>
        <button className="calc-btn" onClick={onClose} aria-label="Close calculator" title="Close">×</button>
      </div>
      <div className="calc-body">
        {!loaded && <div className="calc-loading">Loading Desmos…</div>}
        <iframe src={DESMOS_URL} title="Desmos graphing calculator" onLoad={() => setLoaded(true)} allow="clipboard-write" />
      </div>
    </div>
  )
}
