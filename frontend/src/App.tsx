import { lazy, Suspense } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { EnvConfigErrorScreen } from '@/components/layout/EnvConfigErrorScreen';
import {
  LoginRouteSkeleton,
  SimuladoExecucaoRouteSkeleton,
} from '@/components/layout/RouteSkeletons';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { envValidation } from '@/config/env';
import { AuthProvider } from '@/features/auth/AuthContext';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import { queryClient } from '@/lib/queryClient';

const LoginPage = lazy(() =>
  import('@/features/auth/LoginPage').then((module) => ({
    default: module.LoginPage,
  }))
);

const TemasRevisaoPage = lazy(() =>
  import('@/features/temas-revisao/TemasRevisaoPage').then((module) => ({
    default: module.TemasRevisaoPage,
  }))
);

const CadernoErrosPage = lazy(() =>
  import('@/features/caderno-erros/CadernoErrosPage').then((module) => ({
    default: module.CadernoErrosPage,
  }))
);

const SimuladosPage = lazy(() =>
  import('@/features/simulados/SimuladosPage').then((module) => ({
    default: module.SimuladosPage,
  }))
);

const SimuladoDetalhePage = lazy(() =>
  import('@/features/simulados/SimuladoDetalhePage').then((module) => ({
    default: module.SimuladoDetalhePage,
  }))
);

const SimuladoExecucaoPage = lazy(() =>
  import('@/features/simulados/SimuladoExecucaoPage').then((module) => ({
    default: module.SimuladoExecucaoPage,
  }))
);

export function App() {
  if (!envValidation.success) {
    return (
      <ThemeProvider>
        <EnvConfigErrorScreen issues={envValidation.issues} />
        <Toaster />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={250}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                <Route
                  path="/login"
                  element={
                    <Suspense fallback={<LoginRouteSkeleton />}>
                      <LoginPage />
                    </Suspense>
                  }
                />

                <Route element={<ProtectedRoute />}>
                  <Route element={<AppLayout />}>
                    <Route path="/" element={<Navigate to="/temas" replace />} />
                    <Route path="/temas" element={<TemasRevisaoPage />} />
                    <Route
                      path="/caderno-erros"
                      element={<CadernoErrosPage />}
                    />
                    <Route path="/simulados" element={<SimuladosPage />} />
                    <Route
                      path="/simulados/:id"
                      element={<SimuladoDetalhePage />}
                    />
                  </Route>
                  <Route
                    path="/simulados/:id/execucao"
                    element={
                      <Suspense fallback={<SimuladoExecucaoRouteSkeleton />}>
                        <SimuladoExecucaoPage />
                      </Suspense>
                    }
                  />
                </Route>

                <Route path="*" element={<Navigate to="/temas" replace />} />
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </QueryClientProvider>
      </TooltipProvider>
      <Toaster />
    </ThemeProvider>
  );
}
