import { useState } from 'react'
import { organizationsApi, devicesApi } from '../../services/api'
import { useLanguage } from '../../i18n'

const VENDORS = ['cisco', 'fortigate', 'huawei', 'aruba', 'aruba_cx']
const DEFAULT_COMMANDS = {
  cisco: 'show running-config',
  fortigate: 'show full-configuration',
  huawei: 'display current-configuration',
  aruba: 'show running-config',
  aruba_cx: 'show running-config',
}
const CSV_HEADERS = ['location', 'site', 'hostname', 'ip_address', 'vendor', 'credential_profile', 'ssh_username', 'ssh_password']

function detectSeparator(firstLine) {
  const tabs = (firstLine.match(/\t/g) || []).length
  const semicolons = (firstLine.match(/;/g) || []).length
  const commas = (firstLine.match(/,/g) || []).length
  if (tabs >= semicolons && tabs >= commas) return '\t'
  return semicolons > commas ? ';' : ','
}

function parseLine(line, sep) {
  const fields = []
  let current = ''
  let inQuotes = false
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes }
    else if (ch === sep && !inQuotes) { fields.push(current.trim()); current = '' }
    else { current += ch }
  }
  fields.push(current.trim())
  return fields
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'))
  if (!lines.length) return { rows: [], sep: ';' }
  const sep = detectSeparator(lines[0])
  return { rows: lines.map(l => parseLine(l, sep)), sep }
}

export default function DeviceImportModal({ onClose, onImportComplete, profiles = [], existingIps = [] }) {
  const { t } = useLanguage()
  const [step, setStep] = useState('upload') // upload | preview | importing | done
  const [parsedRows, setParsedRows] = useState([])
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [result, setResult] = useState(null)
  const [dragOver, setDragOver] = useState(false)

  async function validateAndSet(dataRows, profileMap) {
    // Fetch orgs + sites once — used for both validation and import
    let orgs = []
    try { ({ data: orgs } = await organizationsApi.list()) } catch {}
    const orgMap = {}
    orgs.forEach(o => { orgMap[o.name.toLowerCase()] = o })

    const uniqueLocations = [...new Set(dataRows.map(r => (r[0] || '').trim().toLowerCase()).filter(Boolean))]
    const siteMap = {} // `${orgId}:${siteName}` → siteId
    for (const locName of uniqueLocations) {
      const org = orgMap[locName]
      if (!org) continue
      try {
        const { data: sites } = await organizationsApi.listSites(org.id)
        sites.forEach(s => { siteMap[`${org.id}:${s.name.toLowerCase()}`] = s.id })
      } catch {}
    }

    const existingIpSet = new Set(existingIps.map(ip => ip.trim().toLowerCase()))
    const seenCsvIps = new Set()

    const processed = dataRows
      .filter(r => r.some(f => f))
      .map(fields => {
        const [location = '', site = '', hostname = '', ip_address = '', vendor = '',
          credential_profile = '', ssh_username = '', ssh_password = ''] = fields
        const errors = []

        // Required field checks
        if (!location) errors.push(t('devices.import.errLocation'))
        if (!site) errors.push(t('devices.import.errSite'))
        if (!hostname) errors.push(t('devices.import.errHostname'))

        // IP checks
        if (!ip_address) {
          errors.push(t('devices.import.errIp'))
        } else {
          const ipKey = ip_address.toLowerCase()
          if (existingIpSet.has(ipKey)) {
            errors.push(t('devices.import.errDuplicateIpExisting'))
          } else if (seenCsvIps.has(ipKey)) {
            errors.push(t('devices.import.errDuplicateIpCsv'))
          } else {
            seenCsvIps.add(ipKey)
          }
        }

        // Vendor check
        if (!vendor) {
          errors.push(t('devices.import.errVendorRequired'))
        } else if (!VENDORS.includes(vendor.toLowerCase())) {
          errors.push(t('devices.import.errVendorInvalid'))
        }

        // Credential check
        const profileKey = credential_profile.trim().toLowerCase()
        const resolvedProfile = profileKey ? profileMap[profileKey] : null
        if (profileKey && !resolvedProfile) errors.push(t('devices.import.errProfileNotFound'))
        if (!resolvedProfile && !ssh_username.trim() && !ssh_password.trim()) errors.push(t('devices.import.errCredential'))

        // Location existence check
        let resolvedSiteId = null
        if (location) {
          const org = orgMap[location.toLowerCase()]
          if (!org) {
            errors.push(t('devices.import.errLocationNotFound'))
          } else if (site) {
            const siteId = siteMap[`${org.id}:${site.toLowerCase()}`]
            if (!siteId) {
              errors.push(t('devices.import.errSiteNotFound'))
            } else {
              resolvedSiteId = siteId
            }
          }
        }

        return {
          location, site, hostname, ip_address,
          vendor: vendor.toLowerCase(),
          credential_profile, ssh_username, ssh_password,
          resolvedProfile,
          resolvedSiteId,
          errors,
          valid: errors.length === 0,
        }
      })

    setParsedRows(processed)
    setStep('preview')
  }

  function processFile(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (e) => {
      const { rows: allRows } = parseCSV(e.target.result)
      if (!allRows.length) return
      const firstRow = allRows[0].map(f => f.toLowerCase())
      const isHeader = firstRow.some(f => ['location', 'lokasyon', 'hostname'].includes(f))
      const dataRows = isHeader ? allRows.slice(1) : allRows
      const profileMap = {}
      profiles.forEach(p => { profileMap[p.name.toLowerCase()] = p })
      await validateAndSet(dataRows, profileMap)
    }
    reader.readAsText(file, 'UTF-8')
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    processFile(e.dataTransfer.files[0])
  }

  function downloadTemplate() {
    const rows = [
      CSV_HEADERS,
      ['HQ', 'Main Office', 'SW-CORE-01', '192.168.1.1', 'cisco', '', 'admin', 'Admin123'],
      ['Branch1', 'Izmir Office', 'FW-IZM-01', '10.0.1.1', 'fortigate', 'MyFortiProfile', '', ''],
    ]
    const content = '﻿' + rows.map(r => r.join(';')).join('\n')
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'device_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport() {
    const validRows = parsedRows.filter(r => r.valid)
    setProgress({ done: 0, total: validRows.length })
    setStep('importing')

    let success = 0
    let failed = 0
    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i]
      try {
        await devicesApi.create({
          hostname: row.hostname,
          ip_address: row.ip_address,
          vendor: row.vendor,
          config_command: DEFAULT_COMMANDS[row.vendor] || '',
          site_id: row.resolvedSiteId,
          credential_profile_id: row.resolvedProfile ? row.resolvedProfile.id : null,
          ssh_username: row.ssh_username || null,
          ssh_password: row.ssh_password || null,
        })
        success++
      } catch { failed++ }
      setProgress({ done: i + 1, total: validRows.length })
    }

    setResult({ success, failed })
    setStep('done')
    if (success > 0) onImportComplete()
  }

  const validCount = parsedRows.filter(r => r.valid).length
  const invalidCount = parsedRows.filter(r => !r.valid).length

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl mx-4 max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-800">{t('devices.import.title')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── Upload step ── */}
          {step === 'upload' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">{t('devices.import.uploadDesc')}</p>

              <label
                onDrop={handleDrop}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                  dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                }`}
              >
                <svg className="w-10 h-10 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm text-gray-500">{t('devices.import.dropHere')}</p>
                <p className="text-xs text-gray-400 mt-1">{t('devices.import.orClick')}</p>
                <input type="file" accept=".csv" className="hidden" onChange={e => processFile(e.target.files[0])} />
              </label>

              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm text-blue-700">{t('devices.import.templateHint')}</span>
                <button type="button" onClick={downloadTemplate}
                  className="ml-auto text-sm font-medium text-blue-600 hover:text-blue-800 underline">
                  {t('devices.import.downloadTemplate')}
                </button>
              </div>

              <div className="text-xs text-gray-500 space-y-1">
                <p className="font-medium text-gray-600">{t('devices.import.columns')}:</p>
                <code className="block bg-gray-50 rounded px-3 py-2 text-gray-600">
                  {CSV_HEADERS.join(', ')}
                </code>
                <p>{t('devices.import.vendorHint')}: cisco, fortigate, huawei, aruba, aruba_cx</p>
              </div>
            </div>
          )}

          {/* ── Preview step ── */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  {validCount} {t('devices.import.validRows')}
                </span>
                {invalidCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-sm bg-red-100 text-red-700 px-3 py-1 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    {invalidCount} {t('devices.import.invalidRows')}
                  </span>
                )}
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-80">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        {['#', t('deviceForm.location'), t('deviceForm.branch'),
                          t('deviceForm.hostname'), t('deviceForm.ip'), t('deviceForm.brand'),
                          t('credProfiles.title'), t('deviceForm.sshUser'), 'SSH Şifre', t('devices.import.col.status')]
                          .map(h => (
                            <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>
                          ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {parsedRows.map((row, i) => (
                        <tr key={i} className={row.valid ? '' : 'bg-red-50'}>
                          <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                          <td className="px-3 py-2 text-gray-700">{row.location}</td>
                          <td className="px-3 py-2 text-gray-700">{row.site}</td>
                          <td className="px-3 py-2 text-gray-700 font-medium">{row.hostname}</td>
                          <td className="px-3 py-2 text-gray-500">{row.ip_address}</td>
                          <td className="px-3 py-2 text-gray-500">{row.vendor}</td>
                          <td className="px-3 py-2 text-gray-500">{row.resolvedProfile ? row.resolvedProfile.name : ''}</td>
                          <td className="px-3 py-2 text-gray-500">{row.resolvedProfile ? '' : row.ssh_username}</td>
                          <td className="px-3 py-2 text-gray-500">{row.ssh_password ? 'Gizlendi' : 'Boş'}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {row.valid
                              ? <span className="text-green-600 font-medium">✓ Geçerli</span>
                              : <span className="text-red-500 text-xs whitespace-nowrap" title={row.errors.join('\n')}>✗ {row.errors[0]}</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {validCount === 0 && (
                <p className="text-sm text-red-600 text-center py-2">{t('devices.import.noValidRows')}</p>
              )}
            </div>
          )}

          {/* ── Importing step ── */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                />
              </div>
              <p className="text-sm text-gray-600">
                {progress.done} / {progress.total} {t('devices.import.importing')}
              </p>
            </div>
          )}

          {/* ── Done step ── */}
          {step === 'done' && result && (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-base font-semibold text-gray-800">{t('devices.import.done')}</p>
              <div className="flex gap-3">
                <span className="text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full">
                  {result.success} {t('devices.import.added')}
                </span>
                {result.failed > 0 && (
                  <span className="text-sm bg-red-100 text-red-700 px-3 py-1 rounded-full">
                    {result.failed} {t('devices.import.skipped')}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 flex-shrink-0">
          <button
            onClick={() => step === 'preview' ? setStep('upload') : onClose()}
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            {step === 'preview' ? t('devices.import.back') : t('common.cancel')}
          </button>
          <div>
            {step === 'preview' && (
              <button
                onClick={handleImport}
                disabled={validCount === 0}
                className="inline-flex items-center gap-1.5 bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {t('devices.import.importBtn')} ({validCount})
              </button>
            )}
            {step === 'done' && (
              <button onClick={onClose}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                {t('common.close')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
