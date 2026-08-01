import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { SignBridgeProvider, useSignBridge } from "./context/SignBridgeContext";
import { LandingPage } from "./components/LandingPage";
import { AuthPage } from "./components/AuthPage";
import { Dashboard } from "./components/Dashboard";
import { LecturerWorkspace } from "./components/LecturerWorkspace";
import { StudentWorkspace } from "./components/StudentWorkspace";
import { SavedLessons } from "./components/SavedLessons";
import { SettingsPage } from "./components/SettingsPage";
import { Loader } from "./components/Loader";
import "./App.css";

const DocumentTitleHandler: React.FC = () => {
  const location = useLocation();
  const { activeSession } = useSignBridge();

  useEffect(() => {
    let title = "signbridge.";
    const path = location.pathname;

    if (path === "/") {
      title = "signbridge. | Real-time Educational Accessibility";
    } else if (path === "/auth") {
      title = "signbridge. | Sign In";
    } else if (path === "/dashboard") {
      title = "signbridge. | Lecturer Dashboard";
    } else if (path === "/settings") {
      title = "signbridge. | Settings";
    } else if (path.startsWith("/lecturer/")) {
      title = `signbridge. | Live: ${activeSession?.title || "Lecturer Portal"}`;
    } else if (path.startsWith("/student/")) {
      title = `signbridge. | Live: ${activeSession?.title || "Student Workspace"}`;
    } else if (path.startsWith("/review/")) {
      title = `signbridge. | Review: ${activeSession?.title || "Lecture Review"}`;
    }

    document.title = title;
  }, [location.pathname, activeSession?.title]);

  return null;
};

const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthLoading } = useSignBridge();

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] text-[var(--text)]">
        <Loader label="Initializing SignBridge..." />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

function AppRoutes() {
  const { isAuthLoading } = useSignBridge();

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] text-[var(--text)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-[var(--text-muted)] font-mono">Loading SignBridge...</span>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/student/:code" element={<StudentWorkspace />} />
      <Route path="/review/:sessionId" element={<SavedLessons />} />
      
      {/* Protected Lecturer Routes */}
      <Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
      <Route path="/settings" element={<AuthGuard><SettingsPage /></AuthGuard>} />
      <Route path="/lecturer/:sessionId" element={<AuthGuard><LecturerWorkspace /></AuthGuard>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <SignBridgeProvider>
      <BrowserRouter>
        <DocumentTitleHandler />
        <AppRoutes />
      </BrowserRouter>
    </SignBridgeProvider>
  );
}

export default App;
