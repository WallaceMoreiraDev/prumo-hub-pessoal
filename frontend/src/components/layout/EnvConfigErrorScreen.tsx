import { AlertTriangle, Compass, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { EnvValidationIssue } from '@/config/env';

export interface EnvConfigErrorScreenProps {
  issues: EnvValidationIssue[];
}

export function EnvConfigErrorScreen({ issues }: EnvConfigErrorScreenProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
      <div className="mb-6 flex w-full max-w-lg items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
            <Compass className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-lg font-bold leading-none tracking-tight">
              Prumo
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Prumo Hub Pessoal
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={toggleTheme}
          className="gap-2"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="h-4 w-4" strokeWidth={1.75} />
              <span>Modo Claro</span>
            </>
          ) : (
            <>
              <Moon className="h-4 w-4" strokeWidth={1.75} />
              <span>Modo Escuro</span>
            </>
          )}
        </Button>
      </div>

      <Card className="w-full max-w-lg border-rose-500/30">
        <CardHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl border border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <CardTitle>Configuração de ambiente pendente</CardTitle>
          <CardDescription>
            As variáveis obrigatórias do frontend não foram encontradas ou
            possuem formato inválido. Copie{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
              frontend/.env.example
            </code>{' '}
            para{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
              frontend/.env
            </code>{' '}
            e reinicie o servidor de desenvolvimento.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 rounded-xl border border-border bg-muted/40 p-4 text-sm">
            {issues.map((issue) => (
              <li key={issue.variable} className="flex flex-col gap-0.5">
                <span className="font-mono text-xs font-semibold text-foreground">
                  {issue.variable}
                </span>
                <span className="text-xs text-muted-foreground">
                  {issue.message}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
