export default function ConfigDiff({ lines }) {
  if (!lines || lines.length === 0) {
    return <p className="text-gray-400 text-sm">Diff gösterilecek satır yok.</p>
  }

  return (
    <div className="font-mono text-xs bg-gray-50 border border-gray-200 rounded-lg overflow-auto max-h-[600px]">
      {lines.map((line, i) => {
        let cls = 'px-4 py-0.5'
        if (line.startsWith('+')) cls += ' bg-green-50 text-green-700'
        else if (line.startsWith('-')) cls += ' bg-red-50 text-red-700'
        else if (line.startsWith('@@')) cls += ' bg-blue-50 text-blue-600'
        else cls += ' text-gray-500'

        return (
          <div key={i} className={cls}>
            {line}
          </div>
        )
      })}
    </div>
  )
}
