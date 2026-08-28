import { useEffect, useRef, useState } from 'react'
import { configsApi } from '../../services/api'
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

export default function DeviceRestoreModal({ device, targetSha, onClose, onDone }) {
  const { t } = useLanguage()

  const [status, setStatus] = useState('running') // 'running' | 'success' | 'failed'
  const [result, setResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const startedRef = useRef(false)

  const stepState = status === 'success' ? 'done' : status === 'failed' ? 'error' : 'active'

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    async function run() {
      try {
        const { data } = await configsApi.restore(device.id, targetSha)
        setResult(data)
        setStatus('success')
      } catch (err) {
        setErrorMsg(err.response?.data?.detail || t('deviceRestore.failed'))
        setStatus('failed')
      }
    }

    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (status === 'success') onDone?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">{t('deviceRestore.title')}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{device.hostname} · {device.ip_address}</p>
        </div>

        {/* Steps */}
        <div className="px-5 py-5 space-y-4">
          <div className="flex items-center gap-3">
            <StepIcon state={stepState} />
            <span className={`text-sm ${stepState === 'error' ? 'text-red-600' : 'text-gray-700'}`}>
              {t('deviceRestore.stepApplying')}
            </span>
          </div>

          {status === 'success' && (
            <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
              <p className="text-sm font-medium text-emerald-700">{t('deviceRestore.success')}</p>
              {result?.backup_sha && (
                <p className="text-xs text-emerald-600 mt-0.5">
                  {t('deviceRestore.backupInfo')}: {result.backup_sha.slice(0, 7)}
                </p>
              )}
              {result?.warning && (
                <p className="text-xs text-amber-600 mt-0.5">{result.warning}</p>
              )}
            </div>
          )}

          {status === 'failed' && (
            <div className="mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <p className="text-sm font-medium text-red-700">{t('deviceRestore.failed')}</p>
              <p className="text-xs text-red-600 mt-0.5 break-words">{errorMsg}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            disabled={status === 'running'}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {t('common.close')}
          </button>
        </div>

      </div>
    </div>
  )
}
