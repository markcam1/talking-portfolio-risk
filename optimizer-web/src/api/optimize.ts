import { getClient } from './client'
import type { OptimizeRequest, OptimizationResult } from '../types/api'

export async function optimize(req: OptimizeRequest): Promise<OptimizationResult> {
  const client = await getClient()
  const res = await client.post<OptimizationResult>('/api/optimize', req)
  return res.data
}
