import * as React from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AppLayout } from "@/components/layout/AppLayout";
import Index from "./pages/Index";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import InterventionsPage from "./pages/InterventionsPage";
import InterventionDetailPage from "./pages/InterventionDetailPage";
import NewInterventionPage from "./pages/NewInterventionPage";
import CalendarPage from "./pages/CalendarPage";
import MapPage from "./pages/MapPage";
import AvailableInterventionsPage from "./pages/AvailableInterventionsPage";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";
import DiagnosticPage from "./pages/DiagnosticPage";
import NotFound from "./pages/NotFound";
import { Toaster as Sonner } from "sonner";
import { rescheduleRemindersOnStart } from "@/lib/interventionReminders";

const queryClient = new QueryClient();

// Reschedule reminders when app starts
rescheduleRemindersOnStart();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isLoading } = useAuth();
  if (isLoading) return null;
  if (isLoggedIn) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Index />} />
    <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
    <Route path="/diagnostic" element={<DiagnosticPage />} />
    <Route path="/settings" element={<SettingsPage />} />
    <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/interventions" element={<InterventionsPage />} />
      <Route path="/intervention/new" element={<NewInterventionPage />} />
      <Route path="/intervention/:id" element={<InterventionDetailPage />} />
      <Route path="/calendar" element={<CalendarPage />} />
      <Route path="/map" element={<MapPage />} />
      <Route path="/available" element={<AvailableInterventionsPage />} />
      <Route path="/profile" element={<ProfilePage />} />
    </Route>
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner position="top-center" richColors />
          <BrowserRouter>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
