export function formatDate(input: string | Date | null | undefined): string {
  if (input == null || input === '') return ''
  let d: Date
  if (input instanceof Date) {
    d = input
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, day] = input.split('-').map(Number)
    d = new Date(y, m - 1, day)
  } else {
    d = new Date(input)
  }
  if (isNaN(d.getTime())) return ''
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${mm}/${dd}/${yyyy}`
}

export function mapsUrl(address: string): string {
  return `https://maps.apple.com/?q=${encodeURIComponent(address)}`
}

export function formatDateTime(input: string | Date | null | undefined): string {
  if (input == null || input === '') return ''
  const d = input instanceof Date ? input : new Date(input)
  if (isNaN(d.getTime())) return ''
  const date = formatDate(d)
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${date} ${time}`
}
