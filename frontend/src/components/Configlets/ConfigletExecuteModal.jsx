import { useEffect, useRef, useState } from 'react'
import useAuthStore from '../../store/authStore'
import { useLanguage } from '../../i18n'

// ── Helpers ──────────────────────────────────────────────────────────────────

function ts() {
  return new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function padEnd(str, len) {
  const s = String(str)
  return s.length >= len ? s : s + ' '.repeat(len - s.length)
}

function makeSep(label, width = 72) {
  // e.g.  "CONNECTING [Huawei_Switch] ****...****  12:30:01"
  const stars = '*'.repeat(Math.max(0, width - label.length - 1))
  return `${label} ${stars}`
}

// ── AWX-style terminal line types ─────────────────────────────────────────────
// type: 'header' | 'ok' | 'failed' | 'output' | 'recap-header' | 'recap-row' | 'blank'

function buildLines(events) {
  const lines = []
  const recap = {} // hostname → { ok, failed }

  for (const ev of events) {
    const host = ev.hostname || ''
    const ip = ev.ip_address || ''

    if (ev.type === 'connecting') {
      lines.push({ kind: 'blank' })
      lines.push({ kind: 'header', text: makeSep(`CONNECTING [${host}]`) + '  ' + ts() })
      lines.push({ kind: 'blank' })
    } else if (ev.type === 'sending') {
      lines.push({ kind: 'header', text: makeSep(`SENDING COMMANDS [${host}] (${ev.count} komut)`) + '  ' + ts() })
      lines.push({ kind: 'blank' })
    } else if (ev.type === 'done') {
      if (ev.status === 'success') {
        lines.push({ kind: 'ok', text: `ok: [${host}]` })
        if (ev.output) {
          const outLines = ev.output.trim().split('\n')
          for (const l of outLines) {
            lines.push({ kind: 'output', text: '    ' + l })
          }
        }
        recap[host] = { ok: 1, failed: 0, ip }
      } else {
        lines.push({ kind: 'failed', text: `failed: [${host}]` })
        lines.push({ kind: 'failed', text: `    HATA: ${ev.error || 'Bilinmeyen hata'}` })
        recap[host] = { ok: 0, failed: 1, ip }
      }
      lines.push({ kind: 'blank' })
    } else if (ev.type === 'complete') {
      lines.push({ kind: 'blank' })
      lines.push({ kind: 'recap-header', text: makeSep('PLAY RECAP') + '  ' + ts() })
      for (const [hostname, stats] of Object.entries(recap)) {
        const row = padEnd(hostname, 28) + ': ' +
          'ok=' + stats.ok + '    ' +
          'failed=' + stats.failed
        lines.push({ kind: stats.failed > 0 ? 'failed' : 'ok', text: row })
      }
      lines.push({ kind: 'blank' })
    }
  }

  return lines
}

function TerminalLine({ line, num }) {
  let textCls = 'text-gray-300'
  if (line.kind === 'header' || line.kind === 'recap-header') textCls = 'text-white font-bold'
  else if (line.kind === 'ok') textCls = 'text-emerald-400'
  else if (line.kind === 'failed') textCls = 'text-red-400'
  else if (line.kind === 'output') textCls = 'text-emerald-300'
  else if (line.kind === 'blank') textCls = ''

  return (
    <div className="flex min-w-0">
      <span className="select-none flex-shrink-0 w-10 text-right pr-3 text-gray-600 text-xs leading-5">{num}</span>
      <span className={`font-mono text-xs leading-5 whitespace-pre ${textCls}`}>{line.text || ''}</span>
    </div>
  )
}

// ── Main Modal ─────────────────────────────────────────────────────────────────
export default function ConfigletExecuteModal({ configlet, onClose }) {
  const { t } = useLanguage()
  const token = useAuthStore.getState().token

  // 'confirm' | 'running' | 'done'
  const [phase, setPhase] = useState('confirm')
  const [events, setEvents] = useState([])
  const [progress, setProgress] = useState(0) // 0-100
  const [summary, setSummary] = useState(null) // { total, ok, failed }
  const [error, setError] = useState('')
  const logRef = useRef(null)

  const devices = configlet.devices || []
  const defaults = configlet.variable_defaults || {}
  const variables = configlet.variables || []
  const contentLines = (configlet.content || '').split('\n')
  const previewLines = contentLines.slice(0, 8)
  const hasMore = contentLines.length > 8
  const totalDevices = configlet.device_ids?.length || 0

  // Auto-scroll log to bottom
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [events])

  async function handleRun() {
    setPhase('running')
    setEvents([])
    setProgress(5)
    setError('')

    let doneCount = 0

    try {
      const resp = await fetch(`/api/configlets/${configlet.id}/execute-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          device_ids: configlet.device_ids,
          variables: defaults,
        }),
      })

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}))
        setError(errData.detail || t('configlets.execute.runFail'))
        setPhase('confirm')
        return
      }

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buf += decoder.decode(value, { stream: true })
        const parts = buf.split('\n\n')
        buf = parts.pop() // keep incomplete chunk

        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith('data: ')) continue
          try {
            const ev = JSON.parse(line.slice(6))
            setEvents((prev) => [...prev, ev])

            if (ev.type === 'done') {
              doneCount++
              setProgress(Math.min(95, 5 + Math.round((doneCount / totalDevices) * 90)))
            }
            if (ev.type === 'complete') {
              setProgress(100)
              setSummary({ total: ev.total, ok: ev.ok, failed: ev.failed })
              setPhase('done')
            }
          } catch (_) {}
        }
      }

      if (phase !== 'done') setPhase('done')
    } catch (err) {
      setError(String(err))
      setPhase('confirm')
    }
  }

  const termLines = buildLines(events)

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4 flex flex-col" style={{ maxHeight: '92vh' }}>

        {/* Header */}
        <div className="px-5 py-3.5 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 leading-tight">{configlet.name}</h2>
              <p className="text-xs text-gray-400">{t('configlets.execute.title')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {phase !== 'confirm' && (
              <div className="flex items-center gap-2 text-xs">
                {phase === 'running' && !summary && (
                  <span className="flex items-center gap-1.5 text-blue-600 font-medium">
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    {t('configlets.execute.running')}
                  </span>
                )}
                {summary && (
                  <>
                    {summary.ok > 0 && (
                      <span className="flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">
                        ✓ {summary.ok} başarılı
                      </span>
                    )}
                    {summary.failed > 0 && (
                      <span className="flex items-center gap-1 bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">
                        ✗ {summary.failed} başarısız
                      </span>
                    )}
                  </>
                )}
              </div>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {phase !== 'confirm' && (
          <div className="h-1 bg-gray-200 flex-shrink-0">
            <div
              className={`h-full transition-all duration-500 ${progress === 100 ? (summary?.failed > 0 ? 'bg-red-500' : 'bg-emerald-500') : 'bg-blue-500'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {phase === 'confirm' ? (
            /* ── Confirm ── */
            <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              {/* Code preview */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('configlets.form.content')}</p>
                <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                  <pre className="font-mono text-xs text-gray-700 px-4 py-3 overflow-x-auto whitespace-pre leading-relaxed">
                    {previewLines.join('\n')}
                    {hasMore && <span className="text-gray-400">{`\n... (+${contentLines.length - 8} satır)`}</span>}
                  </pre>
                </div>
              </div>

              {/* Variables */}
              {variables.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('configlets.form.defaultValues')}</p>
                  <div className="space-y-1">
                    {variables.map((v) => (
                      <div key={v} className="flex items-center gap-2 text-sm">
                        <code className="text-blue-700 bg-blue-50 rounded px-1.5 py-0.5 text-xs font-mono">{`{{${v}}}`}</code>
                        <span className="text-gray-400">:</span>
                        <span className="text-gray-800 font-medium">{defaults[v] || <em className="text-gray-400 font-normal">(boş)</em>}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Devices */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('configlets.execute.devicesSection')} ({devices.length})</p>
                {devices.length === 0 ? (
                  <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">⚠ {t('configlets.execute.noSavedDevices')}</p>
                ) : (
                  <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-36 overflow-y-auto">
                    {devices.map((d) => (
                      <div key={d.id} className="flex items-center gap-3 px-3 py-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${d.status === 'online' ? 'bg-emerald-400' : d.status === 'offline' ? 'bg-red-400' : 'bg-gray-400'}`} />
                        <span className="text-sm font-medium text-gray-900">{d.hostname}</span>
                        <span className="text-xs text-gray-400">{d.ip_address}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

              <div className="pt-1 border-t border-gray-100">
                <p className="text-sm font-semibold text-gray-800">{t('configlets.execute.confirm')}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t('configlets.execute.confirmHint')}</p>
              </div>
            </div>
          ) : (
            /* ── Terminal Log ── */
            <div className="flex-1 flex flex-col min-h-0 bg-gray-900">
              <div ref={logRef} className="flex-1 overflow-y-auto px-2 py-3 min-h-0" style={{ fontFamily: 'monospace' }}>
                {termLines.length === 0 && phase === 'running' && (
                  <div className="flex items-center gap-2 px-3 py-2">
                    <svg className="w-3 h-3 animate-spin text-blue-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="font-mono text-xs text-gray-400">{t('configlets.log.initializing')}</span>
                  </div>
                )}
                {termLines.map((line, i) => (
                  <TerminalLine key={i} line={line} num={i + 1} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-gray-200 flex justify-between items-center flex-shrink-0 bg-white">
          <div>
            {phase === 'done' && (
              <button
                onClick={() => { setPhase('confirm'); setEvents([]); setSummary(null); setProgress(0) }}
                className="text-sm text-gray-600 hover:text-gray-900 font-medium"
              >
                ← {t('configlets.execute.backToForm')}
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              {t('common.close')}
            </button>
            {phase === 'confirm' && (
              <button
                onClick={handleRun}
                disabled={devices.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t('configlets.execute.run')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
