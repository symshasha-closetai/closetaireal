import { useState, useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import SplashScreen from "./components/SplashScreen";

import HomeScreen from "./pages/HomeScreen";
const CameraScreen = lazy(() => import("./pages/CameraScreen"));
const WardrobeScreen = lazy(() => import("./pages/WardrobeScreen"));
import AuthScreen from "./pages/AuthScreen";
const ProfileScreen = lazy(() => import("./pages/ProfileScreen"));
const OnboardingScreen = lazy(() => import("./pages/OnboardingScreen"));
const MessagesScreen = lazy(() => import("./pages/MessagesScreen"));
const ChatScreen = lazy(() => import("./pages/ChatScreen"));
const NotFound = lazy(() => import("./pages/NotFound"));
import BottomNav from "./components/BottomNav";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, hasCompletedOnboarding } = useAuth();
  if (loading) return <div className="min-h-screen bg-background" />;
  if (!user) return <Navigate to="/auth" replace />;
  if (hasCompletedOnboarding === false) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
};

const AppRoutes = () => {
  const { user, loading, hasCompletedOnboarding } = useAuth();

  if (loading) return null;

  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <Routes>
        <Route path="/auth" element={user ? <Navigate to="/" replace /> : <AuthScreen />} />
        <Route path="/onboarding" element={
          !user ? <Navigate to="/auth" replace /> :
          hasCompletedOnboarding ? <Navigate to="/" replace /> :
          <OnboardingScreen />
        } />
        <Route path="/" element={<ProtectedRoute><HomeScreen /></ProtectedRoute>} />
        <Route path="/camera" element={<ProtectedRoute><CameraScreen /></ProtectedRoute>} />
        <Route path="/wardrobe" element={<ProtectedRoute><WardrobeScreen /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfileScreen /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      {user && hasCompletedOnboarding !== false && <BottomNav />}
    </Suspense>
  );
};

const App = () => {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  if (showSplash) return <SplashScreen />;

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;
