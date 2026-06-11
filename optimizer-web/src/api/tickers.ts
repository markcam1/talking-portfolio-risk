import { getClient } from './client'
import type { ValidateTickersRequest, ValidateTickersResponse } from '../types/api'

export async function validateTickers(tickers: string[]): Promise<ValidateTickersResponse> {
  const client = await getClient()
  const body: ValidateTickersRequest = { tickers }
  const res = await client.post<ValidateTickersResponse>('/api/validate-tickers', body)
  return res.data
}
