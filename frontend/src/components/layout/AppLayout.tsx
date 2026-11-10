import { useState } from 'react';
import {
  BookOpen,
  BookX,
  Compass,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Timer,
  User as UserIcon,
  type LucideIcon,
} from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAuth } from '@/features/auth/AuthContext';
import { getErrorMessage } from '@/lib/errorMessages';
import { cn } from '@/lib/utils';

const SIDEBAR_STORAGE_KEY = 'prumo-sidebar-collapsed';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: readonly NavItem[] = [
  {
    to: '/temas',
    label: 'Temas e Revisão',
    icon: BookOpen,
  },
  {
    to: '/caderno-erros',
    label: 'Caderno de Erros',
    icon: BookX,
  },
  {
    to: '/simulados',
    label: 'Simulados',
    icon: Timer,
  },
];

function readInitialSidebarCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

interface SidebarBodyProps {
  collapsed: boolean;
  onNavigate?: () => void;
  onToggleCollapse?: () => void;
  showCollapseToggle?: boolean;
}

function SidebarBody({
  collapsed,
  onNavigate,
  onToggleCollapse,
  showCollapseToggle = false,
}: SidebarBodyProps) {
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut(): Promise<void> {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    try {
      await signOut();
      toast.success('Sessão encerrada.');
      navigate('/login', { replace: true });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSigningOut(false);
    }
  }

  const themeLabel = theme === 'dark' ? 'Modo Claro' : 'Modo Escuro';

  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          'flex h-16 items-center border-b border-border/80 px-3',
          collapsed ? 'justify-center' : 'justify-between px-4'
        )}
      >
        <div
          className={cn(
            'flex items-center gap-2.5 overflow-hidden',
            collapsed && 'justify-center'
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
            <Compass className="h-5 w-5" strokeWidth={1.75} />
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate text-base font-bold leading-none tracking-tight text-foreground">
                Prumo
              </p>
              <p className="mt-1 truncate text-[11px] text-muted-foreground">
                Hub Pessoal
              </p>
            </div>
          ) : null}
        </div>

        {showCollapseToggle && !collapsed && onToggleCollapse ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            aria-label="Recolher barra lateral"
            title="Recolher barra lateral"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <PanelLeftClose className="h-4 w-4" strokeWidth={1.75} />
          </Button>
        ) : null}
      </div>

      {showCollapseToggle && collapsed && onToggleCollapse ? (
        <div className="flex justify-center border-b border-border/60 py-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onToggleCollapse}
                aria-label="Expandir barra lateral"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <PanelLeftOpen className="h-4 w-4" strokeWidth={1.75} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Expandir barra lateral</TooltipContent>
          </Tooltip>
        </div>
      ) : null}

      <nav aria-label="Navegação principal" className="flex-1 space-y-1.5 p-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const linkElement = (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors',
                  collapsed && 'justify-center px-2',
                  isActive
                    ? 'border-primary/25 bg-primary/10 text-primary'
                    : 'border-transparent text-muted-foreground hover:bg-accent hover:text-foreground'
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              {!collapsed ? <span className="truncate">{item.label}</span> : null}
            </NavLink>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.to}>
                <TooltipTrigger asChild>{linkElement}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          }

          return linkElement;
        })}
      </nav>

      <div className="mt-auto space-y-3 border-t border-border/80 p-3">
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={toggleTheme}
                aria-label={themeLabel}
                className="w-full"
              >
                {theme === 'dark' ? (
                  <Sun className="h-4 w-4" strokeWidth={1.75} />
                ) : (
                  <Moon className="h-4 w-4" strokeWidth={1.75} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{themeLabel}</TooltipContent>
          </Tooltip>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleTheme}
            className="w-full justify-start gap-2.5"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            ) : (
              <Moon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            )}
            <span>{themeLabel}</span>
          </Button>
        )}

        <Separator />

        {!collapsed ? (
          <div className="flex items-center gap-2.5 rounded-xl bg-muted/50 px-3 py-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground">
              <UserIcon className="h-3.5 w-3.5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">
                {user?.email ?? 'Estudante autenticado'}
              </p>
            </div>
          </div>
        ) : null}

        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={isSigningOut}
                onClick={handleSignOut}
                aria-label="Sair"
                className="w-full text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.75} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              Sair ({user?.email ?? 'conta'})
            </TooltipContent>
          </Tooltip>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isSigningOut}
            onClick={handleSignOut}
            className="w-full justify-start gap-2.5 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
          >
            <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span>Sair</span>
          </Button>
        )}
      </div>
    </div>
  );
}

export function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() =>
    readInitialSidebarCollapsed()
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function handleToggleSidebar(): void {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // Ignora erro caso localStorage não esteja disponível.
      }
      return next;
    });
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside
        className={cn(
          'hidden shrink-0 border-r border-border bg-card/70 transition-[width] duration-200 md:sticky md:top-0 md:flex md:h-screen md:flex-col',
          sidebarCollapsed ? 'w-[72px]' : 'w-64'
        )}
      >
        <SidebarBody
          collapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
          showCollapseToggle
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/60 bg-background/85 px-4 backdrop-blur-md md:hidden">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
              <Compass className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <span className="text-base font-bold tracking-tight">Prumo</span>
          </div>

          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Abrir menu de navegação"
              >
                <Menu className="h-4 w-4" strokeWidth={1.75} />
              </Button>
            </SheetTrigger>
            <SheetContent className="p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Menu do Prumo Hub Pessoal</SheetTitle>
                <SheetDescription>
                  Navegue entre os módulos do ambiente de estudos.
                </SheetDescription>
              </SheetHeader>
              <SidebarBody
                collapsed={false}
                onNavigate={() => setMobileMenuOpen(false)}
              />
            </SheetContent>
          </Sheet>
        </header>

        <main className="flex-1">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
