import { useEffect, useState } from 'react'
import { configletsApi } from '../../services/api'
import { useLanguage } from '../../i18n'

// ── Terminal helpers (same as ConfigletExecuteModal) ─────────────────────────

function padEnd(str, len) {
  const s = String(str)
  return s.length >= len ? s : s + ' '.repeat(len - s.length)
}

function makeSep(label, width = 72) {
  const stars = '*'.repeat(Math.max(0, width - label.length - 1))
  return `${label} ${stars}`
}

function buildTermLines(deviceResults) {
  if (!deviceResults || !Array.isArray(deviceResults)) return []
  const lines = []
  const recap = {}

  for (const ev of deviceResults) {
    const host = ev.hostname || ''
    lines.push({ kind: 'blank' })
    lines.push({ kind: 'header', text: makeSep(`DEVICE [${host}] — ${ev.ip_address || ''}`) })
    lines.push({ kind: 'blank' })

    if (ev.status === 'success') {
      lines.push({ kind: 'ok', text: `ok: [${host}]` })
      if (ev.output) {
        for (const l of ev.output.trim().split('\n')) {
          lines.push({ kind: 'output', text: '    ' + l })
        }
      }
      recap[host] = { ok: 1, failed: 0 }
    } else {
      lines.push({ kind: 'failed', text: `failed: [${host}]` })
      lines.push({ kind: 'failed', text: `    HATA: ${ev.error || 'Bilinmeyen hata'}` })
      recap[host] = { ok: 0, failed: 1 }
    }
    lines.push({ kind: 'blank' })
  }

  if (Object.keys(recap).length > 0) {
    lines.push({ kind: 'recap-header', text: makeSep('PLAY RECAP') })
    for (const [hostname, stats] of Object.entries(recap)) {
      const row = padEnd(hostname, 28) + ': ok=' + stats.ok + '    failed=' + stats.failed
      lines.push({ kind: stats.failed > 0 ? 'failed' : 'ok', text: row })
    }
    lines.push({ kind: 'blank' })
  }

  return lines
}

function TerminalLine({ line, num }) {
  let textCls = 'text-gray-300'
  if (line.kind === 'header' || line.kind === 'recap-header') textCls = 'text-white font-bold'
  else if (line.kind === 'ok') textCls = 'text-emerald-400'
  else if (line.kind === 'failed') textCls = 'text-red-400'
  else if (line.kind === 'output') textCls = 'text-emerald-300'

  return (
    <div className="flex min-w-0">
      <span className="select-none flex-shrink-0 w-10 text-right pr-3 text-gray-600 text-xs leading-5">{num}</span>
      <span className={`font-mono text-xs leading-5 whitespace-pre ${textCls}`}>{line.text || ''}</span>
    </div>
  )
}

// ── Detail View ───────────────────────────────────────────────────────────────

function ExecutionDetail({ exec, onBack, t }) {
  const termLines = buildTermLines(exec.device_results)

  function handleDownload() {
    const text = termLines.map((l) => l.text || '').join('\n')
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const safeName = (exec.configlet_name || 'output').replace(/[^a-zA-Z0-9_-]/g, '_')
    const timestamp = new Date(exec.started_at).toISOString().slice(0, 16).replace('T', '_').replace(':', '-')
    a.href = url
    a.download = `${safeName}_${timestamp}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const dateStr = new Date(exec.started_at).toLocaleString('tr-TR')
  const isManual = exec.trigger_type === 'manual'

  return (
    <div className="flex flex-col h-full">
      {/* Detail header */}
      <div className="px-6 py-4 border-b border-gray-100 flex-shrink-0 space-y-3">
        <button onClick={onBack} className="text-xs text-blue-600 hover:underline font-medium">
          {t('configlets.history.back')}
        </button>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
          <div className="flex gap-2">
            <span className="text-gray-400 text-xs w-20 flex-shrink-0 pt-0.5">{t('configlets.history.detail.template')}</span>
            <span className="font-semibold text-gray-900">{exec.configlet_name}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-400 text-xs w-20 flex-shrink-0 pt-0.5">{t('configlets.history.detail.when')}</span>
            <span className="text-gray-700">{dateStr}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-400 text-xs w-20 flex-shrink-0 pt-0.5">{t('configlets.history.detail.by')}</span>
            <span className="text-gray-700">
              {isManual
                ? (exec.triggered_by_username || '—')
                : <span className="text-amber-600 font-medium">{t('configlets.history.auto')}</span>}
            </span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-400 text-xs w-20 flex-shrink-0 pt-0.5">{t('configlets.history.detail.result')}</span>
            <span className="flex items-center gap-1.5">
              {exec.ok_count > 0 && (
                <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-2 py-0.5 rounded-full">✓ {exec.ok_count}</span>
              )}
              {exec.fail_count > 0 && (
                <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">✗ {exec.fail_count}</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Terminal output */}
      <div className="flex-1 min-h-0 bg-gray-900 overflow-y-auto px-2 py-3">
        {termLines.length === 0 ? (
          <p className="text-gray-500 text-xs px-3 py-2 font-mono">(çıktı yok)</p>
        ) : termLines.map((line, i) => (
          <TerminalLine key={i} line={line} num={i + 1} />
        ))}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-gray-200 flex justify-end flex-shrink-0 bg-white">
        <button
          onClick={handleDownload}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {t('configlets.execute.download')}
        </button>
      </div>
    </div>
  )
}

// ── Main Modal ────────────────────────────────────────────────────────────────

export default function ConfigletHistoryModal({ onClose }) {
  const { t } = useLanguage()
  const [executions, setExecutions] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    configletsApi.listExecutions()
      .then(({ data }) => setExecutions(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 flex flex-col" style={{ maxHeight: '75vh' }}>

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">{t('configlets.history.title')}</h2>
              {!selected && (
                <p className="text-xs text-gray-400 mt-0.5">{executions.length} kayıt</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {selected ? (
            <ExecutionDetail exec={selected} onBack={() => setSelected(null)} t={t} />
          ) : loading ? (
            <div className="py-16 text-center text-gray-400 text-sm">Yükleniyor...</div>
          ) : executions.length === 0 ? (
            <div className="py-16 text-center">
              <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-500 text-sm">{t('configlets.history.empty')}</p>
            </div>
          ) : (
            <div>
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('configlets.history.col.date')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('configlets.history.col.template')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('configlets.history.col.trigger')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('configlets.history.col.type')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('configlets.history.col.result')}</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {executions.map((exec) => {
                    const isManual = exec.trigger_type === 'manual'
                    const allOk = exec.fail_count === 0
                    return (
                      <tr
                        key={exec.id}
                        onClick={() => setSelected(exec)}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                          {new Date(exec.started_at).toLocaleString('tr-TR')}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{exec.configlet_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {isManual
                            ? (exec.triggered_by_username || '—')
                            : <span className="text-amber-600 font-medium text-xs">⏰ {t('configlets.history.auto')}</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            isManual ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {isManual ? t('configlets.history.manual') : t('configlets.history.auto')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {exec.ok_count > 0 && (
                              <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-2 py-0.5 rounded-full">✓ {exec.ok_count}</span>
                            )}
                            {exec.fail_count > 0 && (
                              <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">✗ {exec.fail_count}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <svg className="w-4 h-4 text-gray-400 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
