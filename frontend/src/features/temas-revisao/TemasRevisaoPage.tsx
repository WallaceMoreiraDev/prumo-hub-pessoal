import type { AuthUserDto, HealthCheckDto } from '@shared/types/auth.types';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertCircle,
  BookOpen,
  RefreshCw,
  Server,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/apiClient';
import { formatLocalDateTime } from '@/lib/date';
import { getErrorMessage } from '@/lib/errorMessages';

export function TemasRevisaoPage() {
  const healthQuery = useQuery({
    queryKey: ['system', 'health'],
    queryFn: ({ signal }) =>
      apiClient.get<HealthCheckDto>('/health', { auth: 'none', signal }),
  });

  const authMeQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: ({ signal }) =>
      apiClient.get<AuthUserDto>('/auth/me', { signal }),
  });

  const isRefreshing = healthQuery.isFetching || authMeQuery.isFetching;

  function handleRefresh(): void {
    void healthQuery.refetch();
    void authMeQuery.refetch();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <BookOpen className="h-5 w-5 text-primary" strokeWidth={1.75} />
            <h1 className="text-2xl font-bold tracking-tight">
              Temas e Revisão
            </h1>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Radar de revisão por tema, reflexões próprias e conexões
            bidirecionais entre conteúdos.
          </p>
        </div>

        <Badge variant="secondary" className="w-fit">
          Rota padrão
        </Badge>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Módulo em implementação na próxima fatia vertical</CardTitle>
          <CardDescription>
            A infraestrutura base, autenticação, tema claro/escuro e cliente HTTP
            estão configurados. Na próxima entrega, esta tela receberá o Radar
            de Revisão, registro de prática avulsa e gaveta expansível de
            reflexões e conexões.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" strokeWidth={1.75} />
              <CardTitle className="text-base">
                Diagnóstico de Conectividade BFF
              </CardTitle>
            </div>
            <CardDescription>
              Verificação automática da comunicação Frontend → Hono Workers →
              Supabase Auth via TanStack Query.
            </CardDescription>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="w-fit gap-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
              strokeWidth={1.75}
            />
            <span>Verificar novamente</span>
          </Button>
        </CardHeader>

        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Server
                  className="h-4 w-4 text-muted-foreground"
                  strokeWidth={1.75}
                />
                <span className="font-mono text-xs font-medium">
                  GET /api/v1/health
                </span>
              </div>

              {healthQuery.isPending ? (
                <Skeleton className="h-5 w-16 rounded-lg" />
              ) : healthQuery.isError ? (
                <Badge variant="destructive">Indisponível</Badge>
              ) : (
                <Badge variant="success">Online</Badge>
              )}
            </div>

            <Separator className="my-3" />

            {healthQuery.isPending ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-52" />
              </div>
            ) : healthQuery.isError ? (
              <div className="flex items-start gap-2 text-xs text-rose-600 dark:text-rose-400">
                <AlertCircle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  strokeWidth={1.75}
                />
                <p className="leading-relaxed">
                  {getErrorMessage(healthQuery.error)}
                </p>
              </div>
            ) : (
              <dl className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="font-mono font-medium text-foreground">
                    {healthQuery.data.status}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Runtime</dt>
                  <dd className="font-mono text-foreground">
                    {healthQuery.data.runtime}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Horário local</dt>
                  <dd className="font-mono text-foreground">
                    {formatLocalDateTime(healthQuery.data.timestamp)}
                  </dd>
                </div>
              </dl>
            )}
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck
                  className="h-4 w-4 text-muted-foreground"
                  strokeWidth={1.75}
                />
                <span className="font-mono text-xs font-medium">
                  GET /api/v1/auth/me
                </span>
              </div>

              {authMeQuery.isPending ? (
                <Skeleton className="h-5 w-20 rounded-lg" />
              ) : authMeQuery.isError ? (
                <Badge variant="destructive">Falha na validação</Badge>
              ) : (
                <Badge variant="success">Sessão válida</Badge>
              )}
            </div>

            <Separator className="my-3" />

            {authMeQuery.isPending ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-4 w-36" />
              </div>
            ) : authMeQuery.isError ? (
              <div className="flex items-start gap-2 text-xs text-rose-600 dark:text-rose-400">
                <AlertCircle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  strokeWidth={1.75}
                />
                <p className="leading-relaxed">
                  {getErrorMessage(authMeQuery.error)}
                </p>
              </div>
            ) : (
              <dl className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">E-mail</dt>
                  <dd className="truncate font-medium text-foreground">
                    {authMeQuery.data.email ?? '—'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">User ID</dt>
                  <dd className="truncate font-mono text-foreground">
                    {authMeQuery.data.id}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Último acesso</dt>
                  <dd className="font-mono text-foreground">
                    {formatLocalDateTime(authMeQuery.data.lastSignInAt)}
                  </dd>
                </div>
              </dl>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
