export interface RmOption {
  value: string
  label: string
  description: string
  category: 'starter' | 'advanced'
}

export const RM_OPTIONS: RmOption[] = [
  // ── Starter set ────────────────────────────────────────────────
  {
    value: 'MV',
    label: 'Standard Deviation',
    description: 'Classical Markowitz — minimizes portfolio variance. The most widely used starting point.',
    category: 'starter'
  },
  {
    value: 'MSV',
    label: 'Semi Standard Deviation',
    description: 'Like Standard Deviation but only penalizes downside (negative) returns. Great for risk-averse investors.',
    category: 'starter'
  },
  {
    value: 'CVaR',
    label: 'Cond. Value at Risk',
    description: 'Average loss in the worst α% of scenarios. More sensitive to tail risk than standard deviation.',
    category: 'starter'
  },
  {
    value: 'MDD',
    label: 'Max Drawdown',
    description: 'Minimizes the worst peak-to-trough portfolio decline. Intuitive for investors who hate big losses.',
    category: 'starter'
  },
  {
    value: 'CDaR',
    label: 'Cond. Drawdown at Risk',
    description: 'Average of the worst α% drawdowns — a smoother version of Max Drawdown.',
    category: 'starter'
  },
  // ── Advanced set ───────────────────────────────────────────────
  {
    value: 'MAD',
    label: 'Mean Abs. Deviation',
    description: 'Average absolute deviation from the mean return. Simpler than variance, less sensitive to outliers.',
    category: 'advanced'
  },
  {
    value: 'GMD',
    label: 'Gini Mean Difference',
    description: 'Average absolute difference between all pairs of returns — a robust dispersion measure.',
    category: 'advanced'
  },
  {
    value: 'FLPM',
    label: 'First Lower Partial Moment',
    description: 'Related to the Omega ratio — measures average shortfall below a target return.',
    category: 'advanced'
  },
  {
    value: 'SLPM',
    label: 'Second Lower Partial Moment',
    description: 'Related to the Sortino ratio — penalizes volatility below the target return more heavily.',
    category: 'advanced'
  },
  {
    value: 'EVaR',
    label: 'Entropic Value at Risk',
    description: 'A tighter bound on CVaR using exponential moments — more conservative tail risk measure.',
    category: 'advanced'
  },
  {
    value: 'RLVaR',
    label: 'Relativistic Value at Risk',
    description: 'A generalization of EVaR with a tunable deformation parameter κ.',
    category: 'advanced'
  },
  {
    value: 'WR',
    label: 'Worst Realization',
    description: 'Minimizes the single worst observed return (minimax). Extremely conservative.',
    category: 'advanced'
  },
  {
    value: 'TG',
    label: 'Tail Gini',
    description: 'A tail-focused variant of the Gini Mean Difference, emphasizing extreme losses.',
    category: 'advanced'
  },
  {
    value: 'KT',
    label: 'Square Root of Kurtosis',
    description: 'Penalizes fat-tailed return distributions — useful for exotic or volatile assets.',
    category: 'advanced'
  },
  {
    value: 'SKT',
    label: 'Semi Kurtosis',
    description: 'Like Kurtosis but applied only to the downside tail of returns.',
    category: 'advanced'
  },
  {
    value: 'RG',
    label: 'Range',
    description: 'Difference between maximum and minimum returns — a simple spread measure.',
    category: 'advanced'
  },
  {
    value: 'CVRG',
    label: 'CVaR Range',
    description: 'CVaR of the upper tail minus CVaR of the lower tail.',
    category: 'advanced'
  },
  {
    value: 'TGRG',
    label: 'Tail Gini Range',
    description: 'Tail Gini applied to the return range — combines Gini and range concepts.',
    category: 'advanced'
  },
  {
    value: 'EVRG',
    label: 'EVaR Range',
    description: 'Entropic VaR applied to the return range — most conservative range measure.',
    category: 'advanced'
  },
  {
    value: 'RVRG',
    label: 'RLVaR Range',
    description: 'Relativistic VaR applied to the return range.',
    category: 'advanced'
  },
  {
    value: 'ADD',
    label: 'Average Drawdown',
    description: 'Mean drawdown across all trading periods — less extreme than Max Drawdown.',
    category: 'advanced'
  },
  {
    value: 'EDaR',
    label: 'Entropic Drawdown at Risk',
    description: 'Entropic VaR applied to drawdown sequences — very conservative drawdown measure.',
    category: 'advanced'
  },
  {
    value: 'RLDaR',
    label: 'Relativistic Drawdown at Risk',
    description: 'Relativistic VaR applied to drawdown sequences with tunable parameter κ.',
    category: 'advanced'
  },
  {
    value: 'UCI',
    label: 'Ulcer Index',
    description: 'Root mean square of drawdowns — emphasizes depth and duration of losses.',
    category: 'advanced'
  }
]

export const RM_MAP: Record<string, RmOption> = Object.fromEntries(
  RM_OPTIONS.map(o => [o.value, o])
)

// Risk measures that expose the alpha parameter
export const ALPHA_RM_SET = new Set([
  'CVaR', 'EVaR', 'RLVaR', 'TG', 'CDaR', 'EDaR', 'RLDaR', 'CVRG', 'TGRG', 'EVRG', 'RVRG'
])

export interface ObjOption {
  value: string
  label: string
  description: string
}

export const OBJ_OPTIONS: ObjOption[] = [
  {
    value: 'Sharpe',
    label: 'Maximize Sharpe Ratio',
    description: 'Best risk-adjusted return. Most popular choice for long-term investors.'
  },
  {
    value: 'MinRisk',
    label: 'Minimize Risk',
    description: 'Lowest possible risk for any return level. Great for conservative portfolios.'
  },
  {
    value: 'MaxRet',
    label: 'Maximize Return',
    description: 'Highest expected return regardless of risk. Aggressive strategy.'
  },
  {
    value: 'Utility',
    label: 'Maximize Utility',
    description: 'Balances return vs. risk using your chosen risk aversion (λ). More control than Sharpe.'
  }
]

export interface MethodOption { value: string; label: string; description: string }

export const METHOD_MU_OPTIONS: MethodOption[] = [
  { value: 'hist', label: 'Historical', description: 'Simple average of past returns.' },
  { value: 'ewma1', label: 'EWMA (adjusted)', description: 'Exponential weighting — recent data counts more.' },
  { value: 'ewma2', label: 'EWMA (standard)', description: 'Exponential weighting without bias correction.' },
  { value: 'JS', label: 'James-Stein', description: 'Shrinks estimates toward a common mean — reduces estimation error.' },
  { value: 'BS', label: 'Bayes-Stein', description: 'Bayesian shrinkage toward the global minimum variance portfolio.' },
  { value: 'BOP', label: 'BOP', description: 'Bodnar-Okhrin-Parolya estimator for large portfolios.' }
]

export const METHOD_COV_OPTIONS: MethodOption[] = [
  { value: 'hist', label: 'Historical', description: 'Standard sample covariance matrix.' },
  { value: 'ewma1', label: 'EWMA (adjusted)', description: 'Exponentially weighted — recent correlations count more.' },
  { value: 'ewma2', label: 'EWMA (standard)', description: 'Standard exponential weighting.' },
  { value: 'ledoit', label: 'Ledoit-Wolf', description: 'Shrinkage toward a structured target — robust for many assets.' },
  { value: 'oas', label: 'OAS Shrinkage', description: 'Oracle Approximation Shrinkage — analytically optimal shrinkage.' },
  { value: 'shrunk', label: 'Basic Shrinkage', description: 'Simple shrinkage toward the identity matrix.' },
  { value: 'gl', label: 'Graphical Lasso', description: 'Sparse precision matrix — good when correlations are sparse.' },
  { value: 'jlogo', label: 'j-LoGo', description: 'Sparse inverse covariance via maximum spanning tree filtering.' },
  { value: 'fixed', label: 'Denoised (Fixed)', description: 'Random matrix theory denoising — fixed point method.' },
  { value: 'spectral', label: 'Denoised (Spectral)', description: 'RMT denoising via spectral cleaning.' },
  { value: 'shrink', label: 'Denoised (Shrink)', description: 'RMT denoising with shrinkage.' },
  { value: 'gerber1', label: 'Gerber Stat 1', description: 'Co-movement based on significant moves — ignores noise.' },
  { value: 'gerber2', label: 'Gerber Stat 2', description: 'Refined Gerber statistic with better treatment of co-movements.' }
]

// Chart colors — 20 distinct colors for pie slices
export const CHART_COLORS = [
  '#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#14b8a6', '#f43f5e',
  '#a78bfa', '#67e8f9', '#fcd34d', '#6ee7b7', '#fca5a5',
  '#c4b5fd', '#a5f3fc', '#fde68a', '#a7f3d0', '#fecdd3'
]
