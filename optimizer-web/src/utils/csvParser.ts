/**
 * Parse a CSV file content into a list of ticker symbols.
 *
 * Accepted formats:
 *   1. Single column, optionally with a header row:
 *      ticker
 *      AAPL
 *      MSFT
 *
 *   2. Any CSV with a column named "ticker" (case-insensitive):
 *      ticker,weight
 *      AAPL,0.25
 *
 * Returns deduplicated, uppercased tickers, empty strings filtered out.
 */
export function parseTickerCsv(content: string): string[] {
  const lines = content
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0)

  if (lines.length === 0) return []

  const firstLine = lines[0].toLowerCase()
  const cols = firstLine.split(',').map(c => c.trim())

  // Find ticker column index
  const tickerColIdx = cols.indexOf('ticker')

  let dataLines: string[]
  let colIdx: number

  if (tickerColIdx !== -1) {
    // Has a header row with a "ticker" column
    dataLines = lines.slice(1)
    colIdx = tickerColIdx
  } else {
    // Assume first column is tickers; if the first value looks like a header, skip it
    colIdx = 0
    const firstValue = cols[0].toUpperCase()
    const looksLikeData = /^[A-Z]{1,6}(-[A-Z]+)?(\.[A-Z]{1,2})?$/.test(firstValue)
    dataLines = looksLikeData ? lines : lines.slice(1)
  }

  const tickers = dataLines
    .map(line => line.split(',')[colIdx]?.trim().toUpperCase() ?? '')
    .filter(t => t.length > 0 && /^[A-Z0-9.^-]{1,10}$/.test(t))

  // Deduplicate preserving order
  return [...new Set(tickers)]
}
