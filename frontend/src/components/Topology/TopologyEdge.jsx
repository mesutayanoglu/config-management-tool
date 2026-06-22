import { useEffect, useRef, useState } from 'react'
import { EdgeLabelRenderer, getBezierPath } from '@xyflow/react'

export default function TopologyEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data,
}) {
  const [hovered, setHovered] = useState(false)
  const pathRef = useRef(null)
  const [srcPos, setSrcPos] = useState(null)
  const [dstPos, setDstPos] = useState(null)

  const [edgePath] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  })

  // Rozetleri düz çizgi yerine asıl bezier eğrisi üzerinden örnekliyoruz,
  // aksi halde kablo kavisli olduğunda etiketler eğriden kopup havada kalıyor.
  useEffect(() => {
    const el = pathRef.current
    if (!el) return
    const totalLength = el.getTotalLength()
    if (!totalLength) return
    const offset = Math.min(70, totalLength * 0.3)
    const p1 = el.getPointAtLength(offset)
    const p2 = el.getPointAtLength(Math.max(0, totalLength - offset))
    setSrcPos({ x: p1.x, y: p1.y })
    setDstPos({ x: p2.x, y: p2.y })
  }, [edgePath])

  const { local_port, neighbor_port } = data || {}

  const shortPort = (p) => {
    if (!p) return null
    // GigabitEthernet0/0/20 → Gi0/0/20, HundredGigE1/0/1 → HuGi1/0/1 etc.
    return p.replace(/^GigabitEthernet/i, 'Gi')
             .replace(/^FastEthernet/i, 'Fa')
             .replace(/^TenGigabitEthernet/i, 'Te')
             .replace(/^HundredGigE/i, 'HuGi')
             .replace(/^Ethernet/i, 'Eth')
             .replace(/^interface/i, '')
             .trim()
  }

  const srcLabel = shortPort(local_port)
  const dstLabel = shortPort(neighbor_port)
  const edgeColor = '#3b82f6'

  const renderBadge = (pos, label, side) => (
    <div
      key={side}
      title={side === 'src' ? local_port || '' : neighbor_port || ''}
      style={{
        position: 'absolute',
        transform: `translate(-50%, -50%) translate(${pos.x}px,${pos.y}px)`,
        pointerEvents: 'none',
        zIndex: 10,
      }}
      className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-semibold border transition-all select-none whitespace-nowrap ${
        hovered
          ? 'bg-blue-600 text-white border-blue-700 shadow-md scale-110'
          : 'bg-white text-slate-600 border-slate-300 shadow-sm'
      }`}
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: hovered ? '#fff' : edgeColor }}
      />
      <span>{label}</span>
    </div>
  )

  return (
    <>
      <path
        ref={pathRef}
        id={id}
        d={edgePath}
        fill="none"
        style={{ stroke: edgeColor, strokeWidth: 2 }}
      />
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        style={{ cursor: 'pointer' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      <EdgeLabelRenderer>
        {srcLabel && srcPos && renderBadge(srcPos, srcLabel, 'src')}
        {dstLabel && dstPos && renderBadge(dstPos, dstLabel, 'dst')}
      </EdgeLabelRenderer>
    </>
  )
}
