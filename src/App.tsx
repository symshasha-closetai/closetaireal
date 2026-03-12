import { useState, useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import SplashScreen from "./components/SplashScreen";

const HomeScreen = lazy(() => import("./pages/HomeScreen"));
const CameraScreen = lazy(() => import("./pages/CameraScreen"));
const WardrobeScreen = lazy(() => import("./pages/WardrobeScreen"));
const AuthScreen = lazy(() => import("./pages/AuthScreen"));
const ProfileScreen = lazy(() => import("./pages/ProfileScreen"));
const OnboardingScreen = lazy(() => import("./pages/OnboardingScreen"));
const NotFound = lazy(() => import("./pages/NotFound"));
const BottomNav = lazy(() => import("./components/BottomNav"));

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, hasCompletedOnboarding } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 rounded-xl gradient-accent mx-auto animate-pulse" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
  if (!user) return <Navigate to="/auth" replace />;
  if (hasCompletedOnboarding === false) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
};

const AppRoutes = () => {
  const { user, loading, hasCompletedOnboarding } = useAuth();

  if (loading) return null;

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-xl gradient-accent mx-auto animate-pulse" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
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
    const timer = setTimeout(() => setShowSplash(false), 2200);
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
