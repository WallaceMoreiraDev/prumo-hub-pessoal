import { useEffect, useMemo, useState } from 'react';
import { Clock, Timer } from 'lucide-react';
import {
  calculateSimuladoTimerSnapshot,
  formatClockDuration,
  resolveTimerConfig,
  saveSimuladoTimerMirror,
  type SimuladoTimerSnapshot,
} from '@/features/simulados/utils/simulados';
import { cn } from '@/lib/utils';

export interface SimuladoTimerProps {
  simuladoId: string;
  startedAt: string | null;
  duracaoConfiguradaSegundos: number;
}

export function SimuladoTimer({
  simuladoId,
  startedAt,
  duracaoConfiguradaSegundos,
}: SimuladoTimerProps) {
  const timerConfig = useMemo(
    () =>
      resolveTimerConfig({
        simuladoId,
        startedAt,
        duracaoConfiguradaSegundos,
      }),
    [simuladoId, startedAt, duracaoConfiguradaSegundos]
  );

  const [snapshot, setSnapshot] = useState<SimuladoTimerSnapshot>(() =>
    calculateSimuladoTimerSnapshot({
      startedAt: timerConfig.startedAt,
      duracaoConfiguradaSegundos: timerConfig.duracaoConfiguradaSegundos,
    })
  );

  useEffect(() => {
    if (
      typeof startedAt === 'string' &&
      !Number.isNaN(Date.parse(startedAt)) &&
      duracaoConfiguradaSegundos >= 1
    ) {
      saveSimuladoTimerMirror({
        simuladoId,
        startedAt,
        duracaoConfiguradaSegundos,
        updatedAt: new Date().toISOString(),
      });
    }
  }, [simuladoId, startedAt, duracaoConfiguradaSegundos]);

  useEffect(() => {
    const updateNow = () => {
      setSnapshot(
        calculateSimuladoTimerSnapshot({
          startedAt: timerConfig.startedAt,
          duracaoConfiguradaSegundos: timerConfig.duracaoConfiguradaSegundos,
          nowMs: Date.now(),
        })
      );
    };

    updateNow();
    const intervalId = window.setInterval(updateNow, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [timerConfig.startedAt, timerConfig.duracaoConfiguradaSegundos]);

  return (
    <div
      className="flex min-w-0 max-w-full flex-wrap items-center gap-2"
      aria-live="off"
      aria-label="Cronômetro do simulado"
    >
      <div
        className={cn(
          'inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border px-3 py-1.5 font-mono text-sm font-semibold tabular-nums sm:text-base',
          snapshot.isOvertime
            ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
            : 'border-border bg-card text-foreground'
        )}
      >
        <Timer
          className={cn(
            'h-4 w-4 shrink-0',
            snapshot.isOvertime
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-primary'
          )}
          strokeWidth={1.75}
        />
        <span>{formatClockDuration(snapshot.remainingSeconds)}</span>
      </div>

      {snapshot.isOvertime ? (
        <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-amber-500/25 bg-amber-500/10 px-2 py-1 font-mono text-xs font-medium text-amber-600 tabular-nums dark:text-amber-400">
          <Clock className="h-3 w-3 shrink-0" strokeWidth={1.75} />
          <span>+{formatClockDuration(snapshot.overtimeSeconds)}</span>
        </span>
      ) : null}
    </div>
  );
}
