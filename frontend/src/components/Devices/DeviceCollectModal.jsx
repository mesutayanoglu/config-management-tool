import { useEffect, useRef, useState } from 'react'
import useAuthStore from '../../store/authStore'
import { useLanguage } from '../../i18n'

function StepIcon({ state }) {
  if (state === 'done') {
    return (
      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    )
  }
  if (state === 'error') {
    return (
      <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </span>
    )
  }
  if (state === 'active') {
    return (
      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </span>
    )
  }
  return <span className="w-5 h-5 rounded-full border-2 border-gray-200 flex-shrink-0" />
}

export default function DeviceCollectModal({ device, onClose, onDone }) {
  const { t } = useLanguage()
  const token = useAuthStore.getState().token

  const [sawFetched, setSawFetched] = useState(false)
  const [sawSaving, setSawSaving] = useState(false)
  const [done, setDone] = useState(null) // { status: 'success'|'failed', ...data }
  const [connError, setConnError] = useState('')
  const startedRef = useRef(false)

  const fetchStepState = sawFetched || sawSaving || done?.status === 'success'
    ? 'done'
    : done?.status === 'failed'
      ? 'error'
      : 'active'

  const saveStepState = done?.status === 'success'
    ? 'done'
    : done?.status === 'failed' && sawSaving
      ? 'error'
      : sawSaving
        ? 'active'
        : 'pending'

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    async function run() {
      try {
        const resp = await fetch(`/api/devices/${device.id}/collect-stream`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!resp.ok || !resp.body) {
          const errData = await resp.json().catch(() => ({}))
          setDone({ status: 'failed', error: errData.detail || t('deviceCollect.failed') })
          return
        }

        const reader = resp.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''

        while (true) {
          const { done: streamDone, value } = await reader.read()
          if (streamDone) break

          buf += decoder.decode(value, { stream: true })
          const parts = buf.split('\n\n')
          buf = parts.pop()

          for (const part of parts) {
            const line = part.trim()
            if (!line.startsWith('data: ')) continue
            try {
              const ev = JSON.parse(line.slice(6))
              if (ev.type === 'fetched') setSawFetched(true)
              else if (ev.type === 'saving') setSawSaving(true)
              else if (ev.type === 'done') setDone(ev)
            } catch (_) {}
          }
        }
      } catch (err) {
        setConnError(String(err))
        setDone({ status: 'failed', error: t('deviceCollect.failed') })
      }
    }

    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (done?.status === 'success') onDone?.()
  }, [done, onDone])

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">{t('deviceCollect.title')}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{device.hostname} · {device.ip_address}</p>
        </div>

        {/* Steps */}
        <div className="px-5 py-5 space-y-4">
          <div className="flex items-center gap-3">
            <StepIcon state={fetchStepState} />
            <span className={`text-sm ${fetchStepState === 'error' ? 'text-red-600' : 'text-gray-700'}`}>
              {t('deviceCollect.stepFetch')}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <StepIcon state={saveStepState} />
            <span className={`text-sm ${saveStepState === 'error' ? 'text-red-600' : saveStepState === 'pending' ? 'text-gray-400' : 'text-gray-700'}`}>
              {t('deviceCollect.stepSave')}
            </span>
          </div>

          {done?.status === 'success' && (
            <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
              <p className="text-sm font-medium text-emerald-700">{t('deviceCollect.success')}</p>
              {(done.model || done.version) && (
                <p className="text-xs text-emerald-600 mt-0.5">
                  {[done.model, done.version].filter(Boolean).join(' · ')}
                </p>
              )}
              {done.is_first_backup === true && (
                <p className="text-xs text-emerald-600 mt-0.5">{t('deviceCollect.firstBackup')}</p>
              )}
              {done.is_first_backup !== true && done.changed === true && (
                <p className="text-xs text-emerald-600 mt-0.5">
                  {t('deviceCollect.changed').replace('{count}', String(done.diff_line_count))}
                </p>
              )}
              {done.is_first_backup !== true && done.changed === false && (
                <p className="text-xs text-emerald-600 mt-0.5">{t('deviceCollect.unchanged')}</p>
              )}
            </div>
          )}

          {done?.status === 'failed' && (
            <div className="mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <p className="text-sm font-medium text-red-700">{t('deviceCollect.failed')}</p>
              <p className="text-xs text-red-600 mt-0.5 break-words">{done.error || connError}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            disabled={!done}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {t('common.close')}
          </button>
        </div>

      </div>
    </div>
  )
}
