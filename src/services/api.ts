/**
 * @file api.ts
 * Configuración de instancias Axios para football-data.org v4.
 */

import axios, { type AxiosInstance } from 'axios'

const FOOTBALL_DATA_ORG_KEY = (import.meta.env.VITE_FOOTBALLDATA_ORG_KEY as string) || ''

export const footballDataOrg: AxiosInstance = axios.create({
  // Proxy local configurado en vite.config.ts
  baseURL: '/api/football',
  timeout: 15_000,
})

// Interceptor para añadir la API Key
footballDataOrg.interceptors.request.use((config) => {
  if (FOOTBALL_DATA_ORG_KEY) {
    config.headers['X-Auth-Token'] = FOOTBALL_DATA_ORG_KEY
  }
  return config
})

// ─── Helpers tipados ──────────────────────────────────────────────────────────

/**
 * Realiza una petición a football-data.org v4.
 * La v4 normalmente devuelve el payload directamente (ej: { filters: {}, competition: {}, standings: [] })
 * o devuelve errores bajo la estructura { message: string, errorCode: number }.
 */
export async function fetchFromFootballDataOrg<T = any>(
  endpoint: string,
  params?: Record<string, string | number | boolean>,
): Promise<T> {
  try {
    const res = await footballDataOrg.get<T>(endpoint, { params })
    return res.data
  } catch (error: any) {
    if (error.response && error.response.data && error.response.data.message) {
      throw new Error(`API Error: ${error.response.data.message}`)
    }
    throw error
  }
}
