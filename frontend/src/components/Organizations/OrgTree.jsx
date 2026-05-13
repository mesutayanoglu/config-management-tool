export default function OrgTree({ organizations }) {
  if (!organizations || organizations.length === 0) {
    return <p className="text-gray-400 text-sm">Henüz organizasyon eklenmedi.</p>
  }

  return (
    <ul className="space-y-3">
      {organizations.map((org) => (
        <li key={org.id} className="border border-gray-200 rounded-lg p-4">
          <p className="font-semibold text-gray-800">{org.name}</p>
          {org.description && <p className="text-xs text-gray-500 mt-0.5">{org.description}</p>}
          {org.sites && org.sites.length > 0 && (
            <ul className="mt-2 pl-4 space-y-1 border-l border-gray-200">
              {org.sites.map((site) => (
                <li key={site.id} className="text-sm text-gray-600">
                  {site.name}
                  {site.location && <span className="text-xs text-gray-400 ml-1">({site.location})</span>}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  )
}
