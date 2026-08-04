import { request } from './api';

export type JiraProject = { key: string; name: string; id: string };
export type JiraIssue = { key: string; id: string; summary: string; status: string | null };
export type JiraChangelogItem = { field: string; fromString: string | null; toString: string | null };
export type JiraChangelogEntry = { created: string; items: JiraChangelogItem[] };

export async function listJiraProjects(signal?: AbortSignal): Promise<JiraProject[]> {
    const response = await request<{ data: JiraProject[] }>('/api/jira/projects', { signal });
    return response.data;
}

export async function searchJiraIssues(projectKey: string, q = '', signal?: AbortSignal): Promise<JiraIssue[]> {
    const params = new URLSearchParams({ projectKey });
    if (q) params.set('q', q);
    const response = await request<{ data: JiraIssue[] }>(`/api/jira/search?${params}`, { signal });
    return response.data;
}

export async function getJiraChangelog(key: string, signal?: AbortSignal): Promise<JiraChangelogEntry[]> {
    const response = await request<{ data: JiraChangelogEntry[] }>(`/api/jira/issues/${encodeURIComponent(key)}/changelog`, {
        signal,
    });
    return response.data;
}
