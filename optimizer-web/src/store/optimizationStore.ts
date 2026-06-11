import { create } from 'zustand'
import type { OptimizationResult, TickerValidationResult } from '../types/api'
import type { OptimizationConfig } from '../types/domain'
import { DEFAULT_CONFIG } from '../types/domain'

interface OptimizationStore {
  // Upload step
  rawTickers: string[]
  validationResults: TickerValidationResult[]
  validTickers: string[]

  // Config step
  config: OptimizationConfig

  // Result
  result: OptimizationResult | null
  currentRunId: string | null

  // Actions
  setRawTickers: (tickers: string[]) => void
  setValidationResults: (results: TickerValidationResult[]) => void
  removeTicker: (ticker: string) => void
  setConfig: (partial: Partial<OptimizationConfig>) => void
  setResult: (result: OptimizationResult) => void
  loadResult: (result: OptimizationResult) => void
  reset: () => void
}

export const useOptimizationStore = create<OptimizationStore>((set, get) => ({
  rawTickers: [],
  validationResults: [],
  validTickers: [],
  config: { ...DEFAULT_CONFIG },
  result: null,
  currentRunId: null,

  setRawTickers: (tickers) =>
    set({ rawTickers: tickers, validationResults: [], validTickers: [] }),

  setValidationResults: (results) => {
    const valid = results.filter(r => r.valid).map(r => r.ticker)
    set({ validationResults: results, validTickers: valid })
  },

  removeTicker: (ticker) => {
    const state = get()
    const validationResults = state.validationResults.filter(r => r.ticker !== ticker)
    const validTickers = state.validTickers.filter(t => t !== ticker)
    set({ validationResults, validTickers })
  },

  setConfig: (partial) =>
    set(s => ({ config: { ...s.config, ...partial } })),

  setResult: (result) =>
    set({ result, currentRunId: result.run_id }),

  loadResult: (result) =>
    set({ result, currentRunId: result.run_id }),

  reset: () =>
    set({
      rawTickers: [],
      validationResults: [],
      validTickers: [],
      config: { ...DEFAULT_CONFIG },
      result: null,
      currentRunId: null
    })
}))
