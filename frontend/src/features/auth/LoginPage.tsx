import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Compass,
  Loader2,
  LogIn,
  MailCheck,
  Moon,
  Sun,
  UserPlus,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/features/auth/AuthContext';
import {
  LoginSchema,
  SignUpSchema,
  type LoginFormInput,
  type SignUpFormInput,
} from '@/features/auth/auth.schemas';
import { getErrorMessage } from '@/lib/errorMessages';

interface LocationState {
  from?: {
    pathname?: string;
    search?: string;
  };
}

export function LoginPage() {
  const { session, isLoading, signIn, signUp } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState<
    string | null
  >(null);

  const state = location.state as LocationState | null;
  const redirectTarget =
    state?.from?.pathname && state.from.pathname !== '/login'
      ? `${state.from.pathname}${state.from.search ?? ''}`
      : '/temas';

  const loginForm = useForm<LoginFormInput>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const signUpForm = useForm<SignUpFormInput>({
    resolver: zodResolver(SignUpSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (session) {
    return <Navigate to={redirectTarget} replace />;
  }

  async function handleLoginSubmit(values: LoginFormInput): Promise<void> {
    setPendingConfirmationEmail(null);
    try {
      await signIn(values.email, values.password);
      toast.success('Sessão iniciada com sucesso.');
      navigate(redirectTarget, { replace: true });
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  async function handleSignUpSubmit(values: SignUpFormInput): Promise<void> {
    setPendingConfirmationEmail(null);
    try {
      const result = await signUp(values.email, values.password);

      if (result.status === 'already_registered') {
        setPendingConfirmationEmail(null);
        signUpForm.reset({
          email: values.email,
          password: '',
          confirmPassword: '',
        });
        loginForm.setValue('email', values.email);
        setActiveTab('login');
        toast.error(
          'Já existe uma conta cadastrada com este endereço de e-mail. Entre com sua senha abaixo.'
        );
        return;
      }

      if (result.status === 'email_confirmation_required') {
        setPendingConfirmationEmail(values.email);
        signUpForm.reset();
        loginForm.setValue('email', values.email);
        setActiveTab('login');
        toast.success(
          'Conta criada. Verifique seu e-mail para confirmar o cadastro.'
        );
        return;
      }

      toast.success('Conta criada e autenticada com sucesso.');
      navigate(redirectTarget, { replace: true });
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col justify-between bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto flex w-full max-w-md items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
            <Compass className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-lg font-bold leading-none tracking-tight text-foreground">
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
          aria-label={
            theme === 'dark'
              ? 'Alternar para modo claro'
              : 'Alternar para modo escuro'
          }
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

      <main className="mx-auto my-8 w-full max-w-md">
        <Card className="border-border/80 bg-card/95">
          <CardHeader className="space-y-2 pb-4">
            <CardTitle className="text-2xl font-bold tracking-tight">
              Ambiente de Estudos
            </CardTitle>
            <CardDescription>
              Acesse sua conta isolada para gerenciar simulados, caderno de
              erros e revisão conectada de temas.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {pendingConfirmationEmail ? (
              <div
                role="status"
                className="flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3.5 text-sm text-emerald-700 dark:text-emerald-300"
              >
                <MailCheck
                  className="mt-0.5 h-4 w-4 shrink-0"
                  strokeWidth={1.75}
                />
                <div className="space-y-1">
                  <p className="font-medium">Confirmação de e-mail pendente</p>
                  <p className="text-xs leading-relaxed opacity-90">
                    Enviamos um link de confirmação para{' '}
                    <span className="font-medium">
                      {pendingConfirmationEmail}
                    </span>
                    . Após confirmar sua caixa de entrada, entre normalmente
                    abaixo.
                  </p>
                </div>
              </div>
            ) : null}

            <Tabs
              value={activeTab}
              onValueChange={(value) => {
                if (value === 'login' || value === 'signup') {
                  setActiveTab(value);
                }
              }}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-4">
                <form
                  onSubmit={loginForm.handleSubmit(handleLoginSubmit)}
                  noValidate
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="login-email">E-mail</Label>
                    <Input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      placeholder="seu@email.com"
                      disabled={loginForm.formState.isSubmitting}
                      {...loginForm.register('email')}
                    />
                    {loginForm.formState.errors.email ? (
                      <p className="text-xs text-rose-600 dark:text-rose-400">
                        {loginForm.formState.errors.email.message}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password">Senha</Label>
                    <Input
                      id="login-password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="Sua senha"
                      disabled={loginForm.formState.isSubmitting}
                      {...loginForm.register('password')}
                    />
                    {loginForm.formState.errors.password ? (
                      <p className="text-xs text-rose-600 dark:text-rose-400">
                        {loginForm.formState.errors.password.message}
                      </p>
                    ) : null}
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loginForm.formState.isSubmitting}
                  >
                    {loginForm.formState.isSubmitting ? (
                      <>
                        <Loader2
                          className="h-4 w-4 animate-spin"
                          strokeWidth={1.75}
                        />
                        <span>Entrando...</span>
                      </>
                    ) : (
                      <>
                        <LogIn className="h-4 w-4" strokeWidth={1.75} />
                        <span>Entrar na plataforma</span>
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-4">
                <form
                  onSubmit={signUpForm.handleSubmit(handleSignUpSubmit)}
                  noValidate
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">E-mail</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      autoComplete="email"
                      placeholder="seu@email.com"
                      disabled={signUpForm.formState.isSubmitting}
                      {...signUpForm.register('email')}
                    />
                    {signUpForm.formState.errors.email ? (
                      <p className="text-xs text-rose-600 dark:text-rose-400">
                        {signUpForm.formState.errors.email.message}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Senha</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Mínimo de 6 caracteres"
                      disabled={signUpForm.formState.isSubmitting}
                      {...signUpForm.register('password')}
                    />
                    {signUpForm.formState.errors.password ? (
                      <p className="text-xs text-rose-600 dark:text-rose-400">
                        {signUpForm.formState.errors.password.message}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm-password">
                      Confirmar senha
                    </Label>
                    <Input
                      id="signup-confirm-password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Repita a senha"
                      disabled={signUpForm.formState.isSubmitting}
                      {...signUpForm.register('confirmPassword')}
                    />
                    {signUpForm.formState.errors.confirmPassword ? (
                      <p className="text-xs text-rose-600 dark:text-rose-400">
                        {signUpForm.formState.errors.confirmPassword.message}
                      </p>
                    ) : null}
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={signUpForm.formState.isSubmitting}
                  >
                    {signUpForm.formState.isSubmitting ? (
                      <>
                        <Loader2
                          className="h-4 w-4 animate-spin"
                          strokeWidth={1.75}
                        />
                        <span>Criando conta...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4" strokeWidth={1.75} />
                        <span>Criar conta</span>
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>

      <footer className="mx-auto w-full max-w-md text-center text-xs text-muted-foreground">
        Prumo Hub Pessoal — Dados isolados por conta via autenticação e BFF.
      </footer>
    </div>
  );
}
