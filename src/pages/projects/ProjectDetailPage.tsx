import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    PROJECT_PRIORITY_LABELS,
    PROJECT_STATUS_LABELS,
    PROJECT_TYPE_LABELS,
    deleteProject,
    getProject,
    updateProject,
    type Project,
    type ProjectInput,
} from '@/lib/projects';
import { toastError, toastSuccess } from '@/lib/toast';
import { ProjectSheet } from '@/pages/projects/ProjectSheet';

function Row({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-4">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="text-sm text-foreground">{value}</dd>
        </div>
    );
}

export function ProjectDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const projectId = Number(id);

    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        if (!Number.isFinite(projectId) || projectId < 1) {
            toastError('Proyecto no válido');
            setLoadFailed(true);
            setLoading(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        setLoadFailed(false);
        void getProject(projectId)
            .then((p) => {
                if (!cancelled) setProject(p);
            })
            .catch((err) => {
                if (!cancelled) {
                    toastError(err);
                    setProject(null);
                    setLoadFailed(true);
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [projectId]);

    async function load() {
        setLoading(true);
        setLoadFailed(false);
        try {
            setProject(await getProject(projectId));
        } catch (err) {
            toastError(err);
            setProject(null);
            setLoadFailed(true);
        } finally {
            setLoading(false);
        }
    }

    async function handleSave(data: ProjectInput) {
        await updateProject(projectId, data);
        toastSuccess('Proyecto actualizado');
        await load();
    }

    async function handleDelete() {
        setDeleting(true);
        try {
            await deleteProject(projectId);
            toastSuccess('Proyecto eliminado');
            navigate('/dashboard/projects');
        } catch (err) {
            toastError(err);
            setDeleting(false);
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col gap-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-40 w-full" />
            </div>
        );
    }

    if (loadFailed && !project) {
        return (
            <div className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">No se pudo cargar el proyecto.</p>
                <Button variant="outline" className="w-fit cursor-pointer" render={<Link to="/dashboard/projects" />}>
                    <ArrowLeft />
                    Volver a proyectos
                </Button>
            </div>
        );
    }

    if (!project) return null;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="mb-2 -ml-2 cursor-pointer"
                        render={<Link to="/dashboard/projects" />}
                    >
                        <ArrowLeft />
                        Proyectos
                    </Button>
                    <div className="flex items-center gap-3">
                        <span
                            className="inline-block size-3 shrink-0 rounded-full border border-border"
                            style={{ backgroundColor: project.color || 'var(--primary)' }}
                            aria-hidden
                        />
                        <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">{project.name}</h1>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">Overview del proyecto</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" className="cursor-pointer" onClick={() => setSheetOpen(true)}>
                        <Pencil />
                        Editar
                    </Button>
                    <Button type="button" variant="destructive" className="cursor-pointer" onClick={() => setDeleteOpen(true)}>
                        <Trash2 />
                        Eliminar
                    </Button>
                </div>
            </div>

            <dl className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:p-6">
                <Row
                    label="Cliente"
                    value={
                        project.client ? (
                            <Link
                                to={`/dashboard/clients`}
                                className="cursor-pointer text-primary transition-colors duration-200 hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
                            >
                                {project.client.name}
                            </Link>
                        ) : (
                            '—'
                        )
                    }
                />
                <Row label="Tipo" value={PROJECT_TYPE_LABELS[project.type]} />
                <Row label="Estado" value={PROJECT_STATUS_LABELS[project.status]} />
                <Row label="Prioridad" value={PROJECT_PRIORITY_LABELS[project.priority]} />
                <Row label="Inicio" value={project.startDate || '—'} />
                <Row label="Fin" value={project.endDate || '—'} />
                <Row label="Icono" value={project.icon || '—'} />
                <Row
                    label="Descripción"
                    value={project.description ? <span className="whitespace-pre-wrap">{project.description}</span> : '—'}
                />
            </dl>

            <ProjectSheet open={sheetOpen} mode="edit" project={project} onOpenChange={setSheetOpen} onSubmit={handleSave} />

            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Eliminar proyecto</DialogTitle>
                        <DialogDescription>¿Eliminar «{project.name}»? Soft delete.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            className="cursor-pointer"
                            onClick={() => setDeleteOpen(false)}
                            disabled={deleting}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            className="cursor-pointer"
                            onClick={() => void handleDelete()}
                            disabled={deleting}
                        >
                            {deleting ? 'Eliminando…' : 'Eliminar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
