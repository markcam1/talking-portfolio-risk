import axios, { AxiosInstance } from 'axios'

const BASE_URL = (import.meta as any).env?.VITE_OPTIMIZER_API_URL ?? 'http://127.0.0.1:8077'

let _client: AxiosInstance | null = null

export async function getClient(): Promise<AxiosInstance> {
  if (_client) return _client
  _client = axios.create({
    baseURL: BASE_URL,
    timeout: 120_000,
    headers: { 'Content-Type': 'application/json' }
  })
  return _client
}
