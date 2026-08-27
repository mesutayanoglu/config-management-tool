import { useMemo, useRef, useState } from 'react'

const CONTEXT = 3 // her değişikliğin etrafında görünür kalacak değişmeyen satır sayısı

// LCS tabanlı satır diff: sol=eski, sağ=yeni
function computeDiff(textA, textB) {
  const a = textA.split('\n')
  const b = textB.split('\n')
  const m = a.length, n = b.length

  // LCS dp tablosu
  const dp = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1))
  for (let i = m - 1; i >= 0; i--)
    for (let j = n - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? 1 + dp[i + 1][j + 1] : Math.max(dp[i + 1][j], dp[i][j + 1])

  const rows = []
  let i = 0, j = 0, leftNum = 1, rightNum = 1
  while (i < m || j < n) {
    if (i < m && j < n && a[i] === b[j]) {
      rows.push({ type: 'equal', left: { text: a[i], num: leftNum++ }, right: { text: b[j], num: rightNum++ } })
      i++; j++
    } else if (i < m && (j >= n || dp[i + 1][j] >= dp[i][j + 1])) {
      rows.push({ type: 'removed', left: { text: a[i], num: leftNum++ }, right: null })
      i++
    } else {
      rows.push({ type: 'added', left: null, right: { text: b[j], num: rightNum++ } })
      j++
    }
  }
  return rows
}

// Ardışık satırları grupla: değişiklik blokları olduğu gibi kalır, uzun değişmemiş
// bloklar 'collapsed' olarak işaretlenir (etrafında CONTEXT kadar satır görünür bırakılır).
function groupRows(rows, context) {
  const groups = []
  let changeIndex = 0
  let collapsedId = 0
  let i = 0

  while (i < rows.length) {
    if (rows[i].type !== 'equal') {
      const start = i
      while (i < rows.length && rows[i].type !== 'equal') i++
      groups.push({ type: 'change', items: rows.slice(start, i), changeIndex: changeIndex++ })
    } else {
      const start = i
      while (i < rows.length && rows[i].type === 'equal') i++
      const run = rows.slice(start, i)
      const isFirst = start === 0
      const isLast = i === rows.length
      const hiddenCount = run.length - (isFirst ? 0 : context) - (isLast ? 0 : context)

      if (hiddenCount <= 0) {
        groups.push({ type: 'context', items: run })
      } else {
        const before = isFirst ? [] : run.slice(0, context)
        const after = isLast ? [] : run.slice(run.length - context)
        const middle = run.slice(before.length, run.length - after.length)
        if (before.length) groups.push({ type: 'context', items: before })
        groups.push({ type: 'collapsed', id: collapsedId++, items: middle })
        if (after.length) groups.push({ type: 'context', items: after })
      }
    }
  }
  return { groups, changeCount: changeIndex }
}

export default function SideBySideDiff({ contentA, contentB, shaA, shaB }) {
  const [showFull, setShowFull] = useState(false)
  const [expandedIds, setExpandedIds] = useState(new Set())
  const [activeChange, setActiveChange] = useState(0)
  const changeRefs = useRef([])

  const rows = useMemo(() => computeDiff(contentA || '', contentB || ''), [contentA, contentB])

  const { groups, changeCount } = useMemo(
    () => groupRows(rows, showFull ? Infinity : CONTEXT),
    [rows, showFull]
  )

  if (!contentA && !contentB) return null

  const removedCount = rows.filter(r => r.type === 'removed').length
  const addedCount = rows.filter(r => r.type === 'added').length

  function expandGroup(id) {
    setExpandedIds(prev => new Set(prev).add(id))
  }

  function jumpTo(idx) {
    if (changeCount === 0) return
    const next = ((idx % changeCount) + changeCount) % changeCount
    setActiveChange(next)
    changeRefs.current[next]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className="text-xs">
      {/* Özet + gezinme */}
      <div className="flex items-center flex-wrap gap-4 mb-3 px-1">
        <span className="text-gray-500">
          <span className="text-red-500 font-semibold">−{removedCount}</span>
          {' / '}
          <span className="text-green-600 font-semibold">+{addedCount}</span>
          {' '}satır değişti
        </span>
        <span className="text-gray-400 text-[10px]">{shaA?.slice(0, 7)} → {shaB?.slice(0, 7)}</span>

        {changeCount > 0 && (
          <div className="flex items-center gap-1.5 ml-auto">
            <button
              onClick={() => jumpTo(activeChange - 1)}
              className="px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
              title="Önceki değişiklik"
            >
              ↑
            </button>
            <span className="text-gray-500 text-[11px] tabular-nums px-1">
              Değişiklik {activeChange + 1} / {changeCount}
            </span>
            <button
              onClick={() => jumpTo(activeChange + 1)}
              className="px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
              title="Sonraki değişiklik"
            >
              ↓
            </button>
            <button
              onClick={() => { setShowFull(v => !v); setExpandedIds(new Set()) }}
              className="ml-2 px-2.5 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 text-[11px]"
            >
              {showFull ? 'Sadece Değişiklikleri Göster' : 'Tüm Dosyayı Göster'}
            </button>
          </div>
        )}
      </div>

      {/* Tablo — kod içeriği monospace kalmalı */}
      <div className="border border-gray-200 rounded-lg overflow-hidden overflow-x-auto font-mono">
        <table className="w-full border-collapse" style={{ tableLayout: 'fixed', minWidth: '900px' }}>
          <colgroup>
            <col style={{ width: '3rem' }} />
            <col style={{ width: '50%' }} />
            <col style={{ width: '3rem' }} />
            <col style={{ width: '50%' }} />
          </colgroup>
          <thead>
            <tr className="bg-gray-100 border-b border-gray-200">
              <th className="text-center text-[10px] text-gray-400 py-1.5 font-normal">#</th>
              <th className="text-left text-[10px] text-gray-500 py-1.5 px-3 font-normal">
                Eski — <code className="text-gray-600">{shaA?.slice(0, 7)}</code>
              </th>
              <th className="text-center text-[10px] text-gray-400 py-1.5 font-normal">#</th>
              <th className="text-left text-[10px] text-gray-500 py-1.5 px-3 font-normal">
                Yeni — <code className="text-gray-600">{shaB?.slice(0, 7)}</code>
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g, gi) => {
              if (g.type === 'collapsed' && !expandedIds.has(g.id)) {
                return <CollapsedRow key={`c-${g.id}`} count={g.items.length} onExpand={() => expandGroup(g.id)} />
              }
              return g.items.map((row, ri) => (
                <DiffRow
                  key={`${gi}-${ri}`}
                  row={row}
                  rowRef={g.type === 'change' && ri === 0 ? (el) => { changeRefs.current[g.changeIndex] = el } : undefined}
                  active={g.type === 'change' && g.changeIndex === activeChange}
                />
              ))
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CollapsedRow({ count, onExpand }) {
  return (
    <tr className="border-b border-gray-100 bg-gray-50">
      <td colSpan={4} className="py-1.5">
        <button
          onClick={onExpand}
          className="w-full flex items-center justify-center gap-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 py-0.5 rounded transition-colors"
        >
          <span className="text-[11px]">⋯ {count} satır değişmedi ⋯</span>
          <span className="text-[10px] underline">Göster</span>
        </button>
      </td>
    </tr>
  )
}

function DiffRow({ row, rowRef, active }) {
  const { type, left, right } = row

  const leftBg = type === 'removed' ? 'bg-red-50' : type === 'added' ? 'bg-gray-50' : ''
  const rightBg = type === 'added' ? 'bg-green-50' : type === 'removed' ? 'bg-gray-50' : ''
  const leftNumBg = type === 'removed' ? 'bg-red-100 text-red-400' : 'bg-gray-50 text-gray-400'
  const rightNumBg = type === 'added' ? 'bg-green-100 text-green-500' : 'bg-gray-50 text-gray-400'
  const leftPrefix = type === 'removed' ? '−' : ' '
  const rightPrefix = type === 'added' ? '+' : ' '
  const leftTextColor = type === 'removed' ? 'text-red-700' : 'text-gray-700'
  const rightTextColor = type === 'added' ? 'text-green-700' : 'text-gray-700'

  return (
    <tr
      ref={rowRef}
      className={`border-b border-gray-100 last:border-0 hover:bg-gray-50/50 ${active ? 'ring-2 ring-inset ring-blue-300' : ''}`}
    >
      {/* Sol satır numarası */}
      <td className={`text-right px-2 py-0.5 select-none border-r border-gray-200 ${leftNumBg}`} style={{ width: '3rem' }}>
        {left ? left.num : ''}
      </td>
      {/* Sol içerik */}
      <td className={`px-3 py-0.5 whitespace-pre border-r border-gray-200 ${leftBg}`}>
        {left ? (
          <span className={leftTextColor}>
            <span className="select-none mr-2 opacity-50">{leftPrefix}</span>
            {left.text}
          </span>
        ) : (
          <span className="block bg-gray-100 h-full w-full">&nbsp;</span>
        )}
      </td>
      {/* Sağ satır numarası */}
      <td className={`text-right px-2 py-0.5 select-none border-r border-gray-200 ${rightNumBg}`} style={{ width: '3rem' }}>
        {right ? right.num : ''}
      </td>
      {/* Sağ içerik */}
      <td className={`px-3 py-0.5 whitespace-pre ${rightBg}`}>
        {right ? (
          <span className={rightTextColor}>
            <span className="select-none mr-2 opacity-50">{rightPrefix}</span>
            {right.text}
          </span>
        ) : (
          <span className="block bg-gray-100 h-full w-full">&nbsp;</span>
        )}
      </td>
    </tr>
  )
}
