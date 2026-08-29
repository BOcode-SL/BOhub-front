import { request } from './api';

export type GlitchTipProject = {
    id: string;
    name: string;
    slug: string;
};

export type GlitchTipIssue = {
    id: string;
    shortId: string | null;
    title: string;
    culprit: string | null;
    level: 'error' | 'warning' | 'info' | 'fatal' | string;
    status: 'unresolved' | 'resolved' | 'ignored' | string;
    count: number;
    userCount: number;
    firstSeen: string | null;
    lastSeen: string | null;
    project: GlitchTipProject | null;
    permalink: string;
};

export type GlitchTipIssuesResponse = {
    data: GlitchTipIssue[];
    configured: boolean;
    baseUrl: string;
    organizationSlug: string;
};

export function getGlitchTipIssues(limit = 5, signal?: AbortSignal): Promise<GlitchTipIssuesResponse> {
    return request<GlitchTipIssuesResponse>(`/api/glitchtip/issues?limit=${limit}`, {
        signal,
    });
}
