import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

type PageCrumbContextValue = {
    crumb: string | null;
    setCrumb: (label: string | null) => void;
};

const PageCrumbContext = createContext<PageCrumbContextValue>({
    crumb: null,
    setCrumb: () => {},
});

export function PageCrumbProvider({ children }: { children: ReactNode }) {
    const { pathname } = useLocation();
    const [crumb, setCrumbState] = useState<string | null>(null);
    const setCrumb = useCallback((label: string | null) => setCrumbState(label), []);

    // clear when route changes so stale detail names don't linger
    useEffect(() => {
        setCrumbState(null);
    }, [pathname]);

    return <PageCrumbContext.Provider value={{ crumb, setCrumb }}>{children}</PageCrumbContext.Provider>;
}

export function usePageCrumbValue() {
    return useContext(PageCrumbContext);
}

/** Set header breadcrumb trailing label while mounted (e.g. project name). */
export function usePageCrumb(label: string | null | undefined) {
    const { setCrumb } = useContext(PageCrumbContext);
    useEffect(() => {
        setCrumb(label?.trim() || null);
        return () => setCrumb(null);
    }, [label, setCrumb]);
}
