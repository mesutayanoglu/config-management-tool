import { Handle, Position } from '@xyflow/react'
import { useLanguage } from '../../i18n'

const VENDOR_COLORS = {
  cisco:     { bg: 'bg-blue-50',   border: 'border-blue-400',  selBorder: 'border-blue-600',  text: 'text-blue-700',  badge: 'bg-blue-100 text-blue-700' },
  fortigate: { bg: 'bg-red-50',    border: 'border-red-400',   selBorder: 'border-red-600',   text: 'text-red-700',   badge: 'bg-red-100 text-red-700' },
  huawei:    { bg: 'bg-rose-50',   border: 'border-rose-400',  selBorder: 'border-rose-600',  text: 'text-rose-700',  badge: 'bg-rose-100 text-rose-700' },
  aruba:     { bg: 'bg-orange-50', border: 'border-orange-400',selBorder: 'border-orange-600',text: 'text-orange-700',badge: 'bg-orange-100 text-orange-700' },
  aruba_cx:  { bg: 'bg-amber-50',  border: 'border-amber-400', selBorder: 'border-amber-600', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
}

function VendorIcon({ vendor }) {
  if (!vendor) {
    return (
      <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
      </svg>
    )
  }
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h14a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 11h2v2H7zM11 11h2v2h-2zM15 11h2v2h-2z" />
    </svg>
  )
}

export default function TopologyNode({ data, selected }) {
  const { t } = useLanguage()
  const { hostname, ip, vendor, known } = data

  const style = vendor
    ? (VENDOR_COLORS[vendor.toLowerCase()] || VENDOR_COLORS.cisco)
    : null

  if (!known) {
    return (
      <div className={`relative bg-slate-50 border-2 border-dashed rounded-xl px-4 py-3 min-w-[160px] shadow-sm transition-all ${
        selected ? 'border-slate-500 shadow-md ring-2 ring-slate-400 ring-offset-1' : 'border-slate-300'
      }`}>
        <Handle type="target" position={Position.Top} className="!bg-slate-400 !w-2 !h-2" />
        <Handle type="source" position={Position.Bottom} className="!bg-slate-400 !w-2 !h-2" />
        <Handle type="target" position={Position.Left} className="!bg-slate-400 !w-2 !h-2" />
        <Handle type="source" position={Position.Right} className="!bg-slate-400 !w-2 !h-2" />
        <div className="flex items-center gap-2 mb-1">
          <VendorIcon vendor={null} />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            {t('topology.unknownDevice')}
          </span>
        </div>
        <p className="text-sm font-medium text-slate-600 truncate max-w-[160px]" title={hostname}>{hostname}</p>
        <p className="text-xs text-slate-400 font-mono">{ip}</p>
      </div>
    )
  }

  return (
    <div className={`relative ${style.bg} border-2 rounded-xl px-4 py-3 min-w-[160px] shadow-sm transition-all ${
      selected ? `${style.selBorder} shadow-md ring-2 ring-offset-1 ring-blue-400` : style.border
    }`}>
      <Handle type="target" position={Position.Top} className="!bg-blue-400 !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} className="!bg-blue-400 !w-2 !h-2" />
      <Handle type="target" position={Position.Left} className="!bg-blue-400 !w-2 !h-2" />
      <Handle type="source" position={Position.Right} className="!bg-blue-400 !w-2 !h-2" />
      <div className="flex items-center gap-2 mb-1">
        <span className={style.text}><VendorIcon vendor={vendor} /></span>
        {vendor && (
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${style.badge} uppercase`}>
            {vendor}
          </span>
        )}
      </div>
      <p className="text-sm font-semibold text-gray-800 truncate max-w-[160px]" title={hostname}>{hostname}</p>
      <p className="text-xs text-slate-500 font-mono">{ip}</p>
    </div>
  )
}
