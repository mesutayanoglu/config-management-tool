import { useEffect, useState } from 'react'
import { useLanguage } from '../../i18n'

const inputCls =
  'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow placeholder-slate-400'

export default function CredentialProfileModal({ profiles, onAdd, onUpdate, onDelete, onClose }) {
  const { t } = useLanguage()
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ name: '', ssh_username: '', ssh_password: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function selectProfile(p) {
    setSelected(p)
    setForm({ name: p.name, ssh_username: p.ssh_username, ssh_password: '' })
  }

  function resetForm() {
    setSelected(null)
    setForm({ name: '', ssh_username: '', ssh_password: '' })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.ssh_username.trim()) return
    setSubmitting(true)
    try {
      if (selected) {
        const data = { name: form.name.trim(), ssh_username: form.ssh_username.trim() }
        if (form.ssh_password) data.ssh_password = form.ssh_password
        onUpdate(selected.id, data)
      } else {
        onAdd(form.name.trim(), form.ssh_username.trim(), form.ssh_password)
      }
      resetForm()
    } finally {
      setSubmitting(false)
    }
  }

  function handleDelete(p) {
    onDelete(p.id)
    if (selected?.id === p.id) resetForm()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-modal w-full max-w-2xl mx-4 flex flex-col max-h-[88vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">{t('credProfiles.title')}</h2>
              <p className="text-xs text-slate-400 mt-0.5">{t('credProfiles.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body — two columns */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Left: profile list */}
          <div className="w-64 flex-shrink-0 border-r border-slate-100 flex flex-col">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {t('credProfiles.title')}
              </span>
              <span className="text-xs bg-slate-100 text-slate-500 font-medium px-1.5 py-0.5 rounded-full">
                {profiles.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
              {profiles.length === 0 ? (
                <div className="text-center py-8 px-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-2">
                    <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </div>
                  <p className="text-xs text-slate-400">{t('credProfiles.empty')}</p>
                </div>
              ) : profiles.map((p) => (
                <div
                  key={p.id}
                  onClick={() => selectProfile(p)}
                  className={`group flex items-center justify-between rounded-lg px-3 py-2.5 cursor-pointer transition-all ${
                    selected?.id === p.id
                      ? 'bg-blue-50 border border-blue-200'
                      : 'hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium truncate ${selected?.id === p.id ? 'text-blue-700' : 'text-slate-700'}`}>
                      {p.name}
                    </p>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{p.ssh_username}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(p) }}
                    title={t('common.delete')}
                    className="opacity-0 group-hover:opacity-100 ml-2 flex-shrink-0 text-slate-300 hover:text-red-500 transition-all p-0.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Right: form */}
          <div className="flex-1 flex flex-col overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">
                  {selected ? selected.name : t('credProfiles.addNew')}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selected ? t('credProfiles.editHint') || 'Bilgileri düzenleyip kaydedin' : t('credProfiles.newHint') || 'Yeni kimlik profili oluşturun'}
                </p>
              </div>
              {selected && (
                <button
                  onClick={resetForm}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 hover:underline"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  {t('credProfiles.addNew')}
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="flex-1 px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  {t('credProfiles.profileName')} <span className="text-red-500">*</span>
                </label>
                <input
                  className={inputCls}
                  value={form.name}
                  required
                  placeholder={t('credProfiles.namePlaceholder')}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  {t('deviceForm.sshUser')} <span className="text-red-500">*</span>
                </label>
                <input
                  className={inputCls}
                  value={form.ssh_username}
                  required
                  autoComplete="off"
                  onChange={(e) => setForm((f) => ({ ...f, ssh_username: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  {t('deviceForm.sshPass')}
                  {selected && (
                    <span className="ml-1.5 text-slate-400 font-normal normal-case tracking-normal">
                      — {t('editModal.passwordPlaceholder') || 'boş bırakılırsa değişmez'}
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  className={inputCls}
                  value={form.ssh_password}
                  autoComplete="new-password"
                  placeholder={selected ? '••••••••' : ''}
                  onChange={(e) => setForm((f) => ({ ...f, ssh_password: e.target.value }))}
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {submitting
                    ? t('common.saving')
                    : selected
                      ? t('credProfiles.updateBtn') || t('common.save')
                      : t('credProfiles.addBtn')}
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    </div>
  )
}
