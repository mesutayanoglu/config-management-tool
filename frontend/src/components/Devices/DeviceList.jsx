/**
 * DeviceList
 *
 * Cihaz verilerini tablo formatında gösteren bileşen.
 * Filtreleme DevicesPage seviyesinde yapılır; bu bileşen
 * sadece kendisine gelen `devices` dizisini render eder.
 *
 * Sütunlar: HOSTNAME | IP | MARKA | SON CONFIG | DURUM | İŞLEMLER
 */
import { useLanguage } from '../../i18n'

export default function DeviceList({
  devices,       // Filtrelenmiş cihaz listesi (DevicesPage'den türetilir)
  allCount,      // Toplam cihaz sayısı — boş durum mesajı için
  onCollect,     // Config alma işlemi callback'i
  onDelete,      // Silme callback'i
  onEdit,        // Düzenleme callback'i
  collectingIds, // Şu an config alınan cihaz ID'leri (Set)
  readOnly,      // true ise aksiyon butonları gizlenir
}) {
  const { t } = useLanguage()

  // ── Durum badge stilleri ──────────────────────────────────────────────────
  const statusConfig = {
    online:  { bg: 'bg-green-100 text-green-700', dot: 'bg-green-500', label: t('deviceList.status.online') },
    offline: { bg: 'bg-red-100 text-red-700',     dot: 'bg-red-500',   label: t('deviceList.status.offline') },
    unknown: { bg: 'bg-gray-100 text-gray-500',   dot: 'bg-gray-400',  label: t('deviceList.status.unknown') },
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">

        {/* ── Tablo başlıkları ── */}
        <thead className="bg-gray-50">
          <tr>
            {[
              t('deviceList.col.hostname'),
              t('deviceList.col.ip'),
              t('deviceList.col.brand'),
              t('deviceList.col.lastConfig'),
              t('deviceList.col.status'),
              t('deviceList.col.actions'),
            ].map(header => (
              <th
                key={header}
                className="px-4 py-3 text-left text-xs font-semibold text-gray-500 tracking-wider"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>

        {/* ── Tablo gövdesi ── */}
        <tbody className="bg-white divide-y divide-gray-200">

          {/* Cihaz satırları */}
          {devices.map(d => {
            const st = statusConfig[d.status] || statusConfig.unknown
            const isCollecting = collectingIds?.has(d.id)

            return (
              <tr key={d.id} className="hover:bg-gray-50 transition-colors">

                {/* Hostname + org/site hiyerarşisi */}
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{d.hostname}</div>
                  {(d.org_name || d.site_name) && (
                    <div className="text-xs text-gray-400 mt-0.5">
                      {[d.org_name, d.site_name].filter(Boolean).join(' / ')}
                    </div>
                  )}
                </td>

                {/* IP adresi — monospace font */}
                <td className="px-4 py-3 font-mono text-xs text-gray-600">
                  {d.ip_address}
                </td>

                {/* Marka + model/versiyon (config çekildikten sonra dolar) */}
                <td className="px-4 py-3">
                  <span className="capitalize text-gray-700">{d.vendor}</span>
                  {(d.model || d.version) && (
                    <div className="text-xs text-gray-400 mt-0.5">
                      {[d.model, d.version].filter(Boolean).join(' • ')}
                    </div>
                  )}
                </td>

                {/* Son config tarihi — yoksa uzun çizgi */}
                <td className="px-4 py-3 text-xs text-gray-500">
                  {d.last_collected_at
                    ? new Date(d.last_collected_at).toLocaleString('tr-TR')
                    : <span className="text-gray-300">—</span>}
                </td>

                {/* Durum badge'i — renkli nokta + etiket */}
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${st.bg}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                    {st.label}
                  </span>
                </td>

                {/* Aksiyon butonları — read-only kullanıcılarda gizlenir */}
                <td className="px-4 py-3">
                  {!readOnly && (
                    <div className="flex items-center gap-2">

                      {/* İndir */}
                      <button
                        onClick={() => onCollect(d.id)}
                        disabled={isCollecting}
                        title="Mevcut konfigürasyonu indirir."
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors
                          ${isCollecting
                            ? 'border-blue-200 bg-blue-50 text-blue-400 cursor-not-allowed'
                            : 'border-blue-300 bg-white text-blue-600 hover:bg-blue-50'}`}
                      >
                        {isCollecting ? (
                          <>
                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                            {t('deviceList.btn.fetching')}
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            {t('deviceList.btn.getConfig')}
                          </>
                        )}
                      </button>

                      {/* Düzenle */}
                      <button
                        onClick={() => onEdit(d)}
                        disabled={isCollecting}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        {t('common.edit')}
                      </button>

                      {/* Sil */}
                      <button
                        onClick={() => onDelete(d.id)}
                        disabled={isCollecting}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium border border-red-200 bg-white text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        {t('common.delete')}
                      </button>

                    </div>
                  )}
                </td>

              </tr>
            )
          })}

          {/* ── Boş durum mesajı ── */}
          {devices.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center text-gray-400 text-sm">
                {/* Filtre aktifken "eşleşme yok", aksi halde "henüz cihaz yok" */}
                {allCount > 0
                  ? t('deviceFilter.noResults')
                  : t('devices.empty')}
              </td>
            </tr>
          )}

        </tbody>
      </table>
    </div>
  )
}
