export const pct = (v: number, decimals = 1): string =>
  `${(v * 100).toFixed(decimals)}%`

export const decimal = (v: number, decimals = 4): string =>
  v.toFixed(decimals)

export const currency = (v: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v)

export const shortDate = (iso: string): string => {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export const relativeTime = (iso: string): string => {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diff = Math.floor((now - then) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}
