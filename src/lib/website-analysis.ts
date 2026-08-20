import { request } from './api'

export interface Paginated<T> {
  data: T[]
  meta: {
    current_page: number
    last_page: number
    per_page: number
    total: number
  }
}

export interface WebsiteAnalysisGrouped {
  domain: string
  totalRuns: number
  lastAnalyzed: string | null
}

export interface WebsiteAnalysis {
  id: string
  domain: string
  clientId: string | null
  seoData: {
    seo: {
      title: string | null
      description: string | null
      h1: string | null
      lang: string | null
      canonical: string | null
    }
    security: {
      hsts: boolean
      csp: boolean
      x_frame_options: string | null
      x_content_type_options: string | null
    }
    dns: {
      a_records: string[]
      mx_records: string[]
      has_spf: boolean
      has_dmarc: boolean
    }
    ssl: {
      valid: boolean
      valid_to_unix: number | null
    }
  } | null
  performanceData: {
    score: number | null
    error?: string | null
  } | null
  createdAt: string
  updatedAt: string
}

export async function fetchWebsiteAnalyses(
  page = 1,
  signal?: AbortSignal
): Promise<Paginated<WebsiteAnalysisGrouped>> {
  return request<Paginated<WebsiteAnalysisGrouped>>(`/api/website-analyses?page=${page}`, { signal })
}

export async function fetchWebsiteAnalysis(id: string, signal?: AbortSignal): Promise<WebsiteAnalysis> {
  const res = await request<{ data: WebsiteAnalysis } | WebsiteAnalysis>(`/api/website-analyses/${id}`, { signal })
  return 'data' in res ? res.data : res
}

export async function fetchWebsiteAnalysisHistory(domain: string, signal?: AbortSignal): Promise<WebsiteAnalysis[]> {
  const res = await request<{ data: WebsiteAnalysis[] } | WebsiteAnalysis[]>(
    `/api/website-analyses/domain/${encodeURIComponent(domain)}`,
    { signal }
  )
  return Array.isArray(res) ? res : res.data
}

export async function createWebsiteAnalysis(data: { domain: string }): Promise<WebsiteAnalysis> {
  const res = await request<{ data: WebsiteAnalysis } | WebsiteAnalysis>('/api/website-analyses', {
    method: 'POST',
    body: data,
  })
  return 'data' in res ? res.data : res
}

export async function deleteWebsiteAnalysis(id: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/api/website-analyses/${id}`, {
    method: 'DELETE',
  })
}
