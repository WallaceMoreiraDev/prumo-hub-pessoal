import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CollapsibleStickySectionProps {
  title: string;
  ariaLabel?: string;
  icon?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  defaultOpen?: boolean;
  variant?: 'card' | 'standalone';
  headingAs?: 'h3' | 'h4';
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  children: ReactNode;
}

/**
 * Subseção colapsável para gavetas de 2º nível com cabeçalho sticky único.
 * Nunca utiliza overflow-hidden em seus wrappers diretos para preservar position: sticky.
 */
export function CollapsibleStickySection({
  title,
  ariaLabel,
  icon,
  badge,
  actions,
  defaultOpen = true,
  variant = 'card',
  headingAs = 'h3',
  className,
  headerClassName,
  bodyClassName,
  children,
}: CollapsibleStickySectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultOpen);
  const panelId = useId();
  const HeadingTag = headingAs;
  const isCard = variant === 'card';

  return (
    <section
      aria-label={ariaLabel ?? title}
      className={cn(
        'min-w-0',
        isCard ? 'rounded-xl border border-border bg-card' : 'space-y-3',
        className
      )}
    >
      <div
        className={cn(
          'sticky top-14 z-20 flex flex-wrap items-center justify-between gap-2 bg-card/95 backdrop-blur-md transition-[border-radius,border-color]',
          'md:top-0',
          isCard
            ? cn(
                'px-4 py-2.5',
                isExpanded
                  ? 'rounded-t-xl border-b border-border/70'
                  : 'rounded-xl border-b-0'
              )
            : 'rounded-xl border border-border/70 px-3.5 py-2.5 shadow-sm',
          headerClassName
        )}
      >
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
          aria-controls={panelId}
          className={cn(
            'group flex items-center justify-between gap-2 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            actions ? 'min-w-[200px] flex-1 sm:min-w-0' : 'w-full min-w-0'
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-2">
            {icon ? <span className="shrink-0">{icon}</span> : null}
            <HeadingTag className="min-w-0 break-words text-sm font-semibold text-foreground">
              {title}
            </HeadingTag>
            {badge ? <span className="shrink-0">{badge}</span> : null}
          </span>

          <span className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors group-hover:bg-accent group-hover:text-foreground">
            <span>{isExpanded ? 'Recolher' : 'Expandir'}</span>
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 transition-transform duration-200',
                isExpanded && 'rotate-180'
              )}
              strokeWidth={1.75}
            />
          </span>
        </button>

        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            {actions}
          </div>
        ) : null}
      </div>

      {isExpanded ? (
        <div
          id={panelId}
          className={cn(isCard ? 'p-4' : 'space-y-3', bodyClassName)}
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}
