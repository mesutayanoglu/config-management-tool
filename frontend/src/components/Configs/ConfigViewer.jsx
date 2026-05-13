export default function ConfigViewer({ content }) {
  if (!content) return <p className="text-gray-400 text-sm">Config seçilmedi.</p>

  return (
    <pre className="bg-gray-50 border border-gray-200 text-gray-800 text-xs p-4 rounded-lg overflow-auto whitespace-pre-wrap font-mono leading-relaxed">
      {content}
    </pre>
  )
}
