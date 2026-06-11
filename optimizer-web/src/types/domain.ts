export interface OptimizationConfig {
  start_date: string
  end_date: string
  rm: string
  obj: string
  rf: number
  l: number
  method_mu: string
  method_cov: string
  alpha: number
  hist: boolean
}

export const DEFAULT_CONFIG: OptimizationConfig = {
  start_date: (() => {
    const d = new Date()
    d.setFullYear(d.getFullYear() - 3)
    return d.toISOString().slice(0, 10)
  })(),
  end_date: new Date().toISOString().slice(0, 10),
  rm: 'MV',
  obj: 'Sharpe',
  rf: 0,
  l: 2,
  method_mu: 'hist',
  method_cov: 'hist',
  alpha: 0.05,
  hist: true
}
