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

export default function SideBySideDiff({ contentA, contentB, shaA, shaB }) {
  if (!contentA && !contentB) return null
  const rows = computeDiff(contentA || '', contentB || '')

  const changed = rows.filter((r) => r.type !== 'equal').length

  return (
    <div className="font-mono text-xs">
      {/* Özet */}
      <div className="flex items-center gap-4 mb-3 px-1">
        <span className="text-gray-500">
          <span className="text-red-500 font-semibold">−{rows.filter(r => r.type === 'removed').length}</span>
          {' / '}
          <span className="text-green-600 font-semibold">+{rows.filter(r => r.type === 'added').length}</span>
          {' '}satır değişti
        </span>
        <span className="text-gray-400 text-[10px]">{shaA?.slice(0, 7)} → {shaB?.slice(0, 7)}</span>
      </div>

      {/* Tablo */}
      <div className="border border-gray-200 rounded-lg overflow-hidden overflow-x-auto">
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
            {rows.map((row, idx) => (
              <DiffRow key={idx} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DiffRow({ row }) {
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
    <tr className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
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
