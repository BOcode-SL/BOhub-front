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

export type AnalysisStatus = 'pending' | 'completed' | 'failed'

export interface WebsiteAnalysisGrouped {
  id?: string
  domain: string
  status: AnalysisStatus
  performanceScore?: number | null
  totalErrors?: number
  lastAnalyzed?: string | null
  lastAnalyzedAt?: string | null
}

export interface AuditFinding {
  id: string
  title: string
  category: 'Security' | 'SEO' | 'AI Discoverability' | 'Infrastructure' | 'Performance' | string
  priority: 'HIGH' | 'MEDIUM' | 'LOW' | 'PASSED'
  status: 'Open' | 'Passed'
  evidence: string
  whyItMatters: string
  recommendedFix: string
}

export interface WebsiteAnalysis {
  id: string
  domain: string
  status: AnalysisStatus
  clientId: string | null
  techStack?: string[] | null
  seoData: {
    seo: {
      title: string | null
      description: string | null
      h1: string | null
      lang: string | null
      canonical: string | null
      og_title?: string | null
      og_image?: string | null
      word_count?: number
    }
    security: {
      hsts: boolean
      hsts_value?: string | null
      csp: boolean
      x_frame_options: string | null
      x_content_type_options: string | null
    }
    dns: {
      a_records: string[]
      mx_records: string[]
      has_spf: boolean
      spf_record?: string | null
      has_dmarc: boolean
      dmarc_record?: string | null
    }
    ssl: {
      valid: boolean
      valid_to_unix: number | null
    }
    tech_stack?: string[]
  } | null
  performanceData: {
    score: number | null
    error?: string | null
  } | null
  auditFindings?: AuditFinding[] | null
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
