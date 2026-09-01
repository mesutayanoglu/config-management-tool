import { Handle, Position } from '@xyflow/react'
import { useLanguage } from '../../i18n'

const VENDOR_COLORS = {
  cisco:     '#2563eb',
  fortigate: '#dc2626',
  huawei:    '#e11d48',
  aruba:     '#ea580c',
  aruba_cx:  '#d97706',
  paloalto:  '#059669',
}

// Firewall/gateway rolündeki vendor'lar daire (router tarzı) sembolle, geri kalanı
// kare (switch tarzı) sembolle çizilir — klasik ağ diyagramı stencil kuralı.
const FIREWALL_VENDORS = new Set(['fortigate', 'paloalto'])
const ICON_SIZE = 56

// Kare çerçeve içinde çapraz çift-yön ok — switch stencili.
function SwitchGlyph({ color }) {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 56 56" fill="none">
      <rect x="2" y="2" width="52" height="52" rx="6" fill="white" stroke={color} strokeWidth="2.5" />
      <g stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 20h22M36 20l-6-6M36 20l-6 6" />
        <path d="M42 36H20M20 36l6-6M20 36l6 6" />
      </g>
    </svg>
  )
}

// Daire içinde 8 yönlü ışınsal ok — router/firewall (gateway) stencili.
function GatewayGlyph({ color }) {
  const rays = Array.from({ length: 8 }, (_, i) => (i * 360) / 8)
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 56 56" fill="none">
      <circle cx="28" cy="28" r="26" fill="white" stroke={color} strokeWidth="2.5" />
      <g stroke={color} strokeWidth="2.2" strokeLinecap="round">
        {rays.map((deg) => (
          <line
            key={deg}
            x1="28" y1="28"
            x2={28 + 15 * Math.cos((deg * Math.PI) / 180)}
            y2={28 + 15 * Math.sin((deg * Math.PI) / 180)}
            transform={`rotate(${deg} 28 28)`}
          />
        ))}
      </g>
      <circle cx="28" cy="28" r="3" fill={color} />
    </svg>
  )
}

function UnknownGlyph() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 56 56" fill="none">
      <rect x="2" y="2" width="52" height="52" rx="6" fill="white" stroke="#94a3b8" strokeWidth="2.5" strokeDasharray="5 4" />
      <text x="28" y="35" textAnchor="middle" fontSize="22" fill="#94a3b8" fontWeight="600">?</text>
    </svg>
  )
}

const dot = '!bg-slate-400 !w-2 !h-2 !border-white !border-2'

export default function TopologyNode({ data, selected }) {
  const { t } = useLanguage()
  const { hostname, ip, vendor, known } = data

  const color = vendor ? (VENDOR_COLORS[vendor.toLowerCase()] || VENDOR_COLORS.cisco) : '#94a3b8'
  const isFirewall = vendor && FIREWALL_VENDORS.has(vendor.toLowerCase())

  return (
    <div className="relative flex flex-col items-center" style={{ width: ICON_SIZE + 8 }}>
      <Handle type="target" position={Position.Top} className={dot} />
      <Handle type="source" position={Position.Bottom} className={dot} />
      <Handle type="target" position={Position.Left} className={dot} />
      <Handle type="source" position={Position.Right} className={dot} />

      <div
        className={`rounded-xl transition-all ${selected ? 'ring-2 ring-offset-2' : ''}`}
        style={selected ? { '--tw-ring-color': color } : undefined}
      >
        {!known ? <UnknownGlyph /> : isFirewall ? <GatewayGlyph color={color} /> : <SwitchGlyph color={color} />}
      </div>

      <div className="mt-1.5 text-center max-w-[110px]">
        {known && vendor && (
          <p className="text-[9px] font-bold uppercase tracking-wider leading-tight" style={{ color }}>
            {vendor}
          </p>
        )}
        {!known && (
          <p className="text-[9px] font-bold uppercase tracking-wider leading-tight text-slate-400">
            {t('topology.unknownDevice')}
          </p>
        )}
        <p className="text-xs font-semibold text-gray-800 truncate" title={hostname}>{hostname}</p>
        <p className="text-[10px] text-slate-400 font-mono truncate">{ip}</p>
      </div>
    </div>
  )
}
