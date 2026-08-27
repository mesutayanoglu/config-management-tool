const VENDOR_LABELS = { paloalto: 'Palo Alto', aruba_cx: 'Aruba CX' }

export function vendorLabel(vendor) {
  if (!vendor) return ''
  return VENDOR_LABELS[vendor] || (vendor.charAt(0).toUpperCase() + vendor.slice(1))
}
