import { NavLink } from 'react-router-dom'
import { useLanguage } from '../../i18n'

export default function Sidebar() {
  const { t } = useLanguage()

  const links = [
    { to: '/', label: t('nav.dashboard') },
    { to: '/devices', label: t('nav.devices') },
    { to: '/configs', label: t('nav.configs') },
    { to: '/schedulers', label: t('nav.schedulers') },
    { to: '/organizations', label: t('nav.locations') },
    { to: '/settings', label: t('nav.settings') },
  ]

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
      <div className="px-6 py-5 border-b border-gray-200">
        <span className="text-lg font-bold text-blue-600">ConfigMgmt</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
            className={({ isActive }) =>
              `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
