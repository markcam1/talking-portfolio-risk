import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { optimize } from '../api/optimize'
import { useOptimizationStore } from '../store/optimizationStore'
import { useUiStore } from '../store/uiStore'
import type { OptimizeRequest } from '../types/api'
import axios from 'axios'

export interface OptimizeError {
  type: 'infeasible' | 'insufficient_data' | 'network' | 'unknown'
  title: string
  message: string
  detail?: string
}

export function useOptimize() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const setResult = useOptimizationStore(s => s.setResult)
  const { addToast, setOptimizing } = useUiStore()

  return useMutation<void, OptimizeError, OptimizeRequest>({
    mutationFn: async (req) => {
      setOptimizing(true)
      try {
        const result = await optimize(req)
        setResult(result)
        queryClient.invalidateQueries({ queryKey: ['runs'] })
        navigate('/results')
      } catch (err) {
        throw parseError(err)
      } finally {
        setOptimizing(false)
      }
    },
    onError: (err) => {
      // Only show toast for non-infeasible errors (infeasible uses a modal)
      if (err.type !== 'infeasible') {
        addToast({ type: 'error', title: err.title, message: err.message })
      }
    }
  })
}

function parseError(err: unknown): OptimizeError {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data
    if (data?.detail?.error === 'infeasible_portfolio') {
      return {
        type: 'infeasible',
        title: 'No Feasible Portfolio Found',
        message: data.detail.message,
        detail: data.detail.detail
      }
    }
    if (data?.detail?.error === 'insufficient_data') {
      return {
        type: 'insufficient_data',
        title: 'Insufficient Data',
        message: data.detail.message
      }
    }
    if (!err.response) {
      return {
        type: 'network',
        title: 'Connection Error',
        message: 'Cannot reach the backend. Please restart the app.'
      }
    }
    return {
      type: 'unknown',
      title: 'Optimization Failed',
      message: data?.detail?.message ?? err.message
    }
  }
  return {
    type: 'unknown',
    title: 'Unexpected Error',
    message: String(err)
  }
}
