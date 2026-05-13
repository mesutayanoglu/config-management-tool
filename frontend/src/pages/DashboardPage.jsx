import { useLanguage } from '../i18n'

export default function DashboardPage() {
  const { t } = useLanguage()

  const cards = [
    { label: t('dashboard.totalDevices'), value: '—' },
    { label: t('dashboard.onlineDevices'), value: '—' },
    { label: t('dashboard.activeSchedulers'), value: '—' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">{t('dashboard.title')}</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-lg border border-gray-200 p-5">
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className="text-3xl font-bold text-gray-800 mt-1">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
