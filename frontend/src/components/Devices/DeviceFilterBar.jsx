/**
 * DeviceFilterBar
 *
 * Cihaz listesi için filtreleme toolbar'ı.
 * - Hostname / IP arama (kısmi, büyük/küçük harf duyarsız)
 * - Marka çoklu seçim (dropdown + checkbox)
 * - Durum çoklu seçim (dropdown + checkbox)
 * - Tümünü temizle butonu (herhangi filtre aktifken görünür)
 * - Filtrelenen / toplam cihaz sayacı
 *
 * Tüm durum yönetimi üst bileşen (DevicesPage) tarafından sağlanır.
 * Bu bileşen sadece görünüm ve kullanıcı etkileşimini yönetir.
 */
import { useState, useRef, useEffect } from 'react'
import { useLanguage } from '../../i18n'

// ─── Sabitler ────────────────────────────────────────────────────────────────

/** DeviceForm ile tutarlı vendor listesi */
const VENDORS = ['cisco', 'fortigate', 'huawei', 'aruba']

/** Status → renk nokta sınıfı eşleşmesi */
const STATUS_META = [
  { value: 'online',  dotClass: 'bg-green-500' },
  { value: 'offline', dotClass: 'bg-red-500'   },
  { value: 'unknown', dotClass: 'bg-gray-400'  },
]

// ─── Alt bileşen: FilterDropdown ─────────────────────────────────────────────

/**
 * Genel amaçlı dropdown filtre bileşeni.
 * Bir tetikleyici buton + checkbox listesinden oluşur.
 * Aktif seçim sayısını rozet olarak gösterir.
 *
 * @param {string}   label    - Buton üzerinde görünen etiket
 * @param {Array}    options  - { value, label, dotClass? } formatında seçenekler
 * @param {string[]} selected - Seçili değerlerin dizisi
 * @param {Function} onChange - Yeni seçim dizisini parametre olarak alan callback
 */
function FilterDropdown({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)

  // Bileşen dışına tıklanınca dropdown'ı kapat
  useEffect(() => {
    function handleOutsideClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  /** Bir değeri seçim listesine ekler veya çıkarır */
  function toggle(value) {
    const next = selected.includes(value)
      ? selected.filter(x => x !== value)
      : [...selected, value]
    onChange(next)
  }

  const isActive = selected.length > 0

  return (
    <div ref={wrapperRef} className="relative">

      {/* Tetikleyici buton — aktif filtre varsa mavi stil */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`
          inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-lg
          transition-all select-none whitespace-nowrap
          ${isActive
            ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}
        `}
      >
        {label}

        {/* Aktif seçim sayısı rozeti */}
        {isActive && (
          <span className="flex items-center justify-center w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] font-bold leading-none">
            {selected.length}
          </span>
        )}

        {/* Aşağı ok — dropdown açıkken döner */}
        <svg
          className={`w-3.5 h-3.5 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Checkbox listesi paneli */}
      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1.5 min-w-[172px]">
          {options.map(opt => (
            <label
              key={opt.value}
              className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => toggle(opt.value)}
                className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              {/* Durum renk noktası (opsiyonel) */}
              {opt.dotClass && (
                <span className={`w-2 h-2 rounded-full shrink-0 ${opt.dotClass}`} />
              )}
              <span className="text-sm text-gray-700 capitalize">{opt.label}</span>
            </label>
          ))}
        </div>
      )}

    </div>
  )
}

// ─── Ana bileşen: DeviceFilterBar ────────────────────────────────────────────

/**
 * Cihaz listesi için filtre çubuğu.
 *
 * Props:
 * @param {number}   totalCount    - Toplam (filtresiz) cihaz sayısı
 * @param {number}   filteredCount - Filtrelenmiş cihaz sayısı
 * @param {object}   filters       - { search: string, vendors: string[], statuses: string[] }
 * @param {Function} onChange      - Yeni filtre nesnesini parametre olarak alan callback
 */
export default function DeviceFilterBar({ totalCount, filteredCount, filters, onChange }) {
  const { t } = useLanguage()

  /** Herhangi bir filtre aktif mi? (Temizle butonunu göstermek için) */
  const hasActive = filters.search.length > 0
    || filters.vendors.length > 0
    || filters.statuses.length > 0

  /** Tüm filtreleri varsayılan değerlere sıfırla */
  function clearAll() {
    onChange({ search: '', vendors: [], statuses: [] })
  }

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white">

      {/* ── Hostname / IP arama kutusu ── */}
      <div className="relative">
        {/* Arama ikonu */}
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
        </svg>

        <input
          type="text"
          value={filters.search}
          onChange={e => onChange({ ...filters, search: e.target.value })}
          placeholder={t('deviceFilter.searchPlaceholder')}
          className="pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
        />

        {/* Temizle (×) — değer varsa görünür */}
        {filters.search && (
          <button
            type="button"
            onClick={() => onChange({ ...filters, search: '' })}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
            aria-label="Aramayı temizle"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Marka dropdown filtresi ── */}
      <FilterDropdown
        label={t('deviceFilter.brand')}
        selected={filters.vendors}
        onChange={vendors => onChange({ ...filters, vendors })}
        options={VENDORS.map(v => ({ value: v, label: v }))}
      />

      {/* ── Durum dropdown filtresi ── */}
      <FilterDropdown
        label={t('deviceFilter.status')}
        selected={filters.statuses}
        onChange={statuses => onChange({ ...filters, statuses })}
        options={STATUS_META.map(s => ({
          value: s.value,
          label: t(`deviceList.status.${s.value}`),
          dotClass: s.dotClass,
        }))}
      />

      {/* ── Tümünü temizle butonu — herhangi bir filtre aktifken görünür ── */}
      {hasActive && (
        <button
          type="button"
          onClick={clearAll}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-500 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          {t('deviceFilter.clearAll')}
        </button>
      )}

      {/* ── Sonuç sayacı — sağa hizalı ── */}
      <span className="ml-auto text-xs text-gray-400 tabular-nums whitespace-nowrap">
        {filteredCount} / {totalCount} {t('deviceFilter.results')}
      </span>

    </div>
  )
}
