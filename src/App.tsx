import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import HomeScreen from "./pages/HomeScreen";
import CameraScreen from "./pages/CameraScreen";
import WardrobeScreen from "./pages/WardrobeScreen";
import AuthScreen from "./pages/AuthScreen";
import ProfileScreen from "./pages/ProfileScreen";
import OnboardingScreen from "./pages/OnboardingScreen";
import NotFound from "./pages/NotFound";
import BottomNav from "./components/BottomNav";
import SplashScreen from "./components/SplashScreen";

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
    <>
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
    </>
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
