import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import Layout from "./components/Layout";
import { Spinner } from "./components/ui";
import AuthPage from "./pages/AuthPage";

// Route-level code splitting: each page (and heavy deps like the chart library) loads on demand.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Resumes = lazy(() => import("./pages/Resumes"));
const AnalysesPage = lazy(() => import("./pages/Analyses").then((m) => ({ default: m.AnalysesPage })));
const AnalysisView = lazy(() => import("./pages/Analyses").then((m) => ({ default: m.AnalysisView })));
const InterviewList = lazy(() => import("./pages/Interviews").then((m) => ({ default: m.InterviewList })));
const InterviewSetup = lazy(() => import("./pages/Interviews").then((m) => ({ default: m.InterviewSetup })));
const InterviewRoom = lazy(() => import("./pages/InterviewRoom"));

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8"><Spinner label="Loading…" /></div>;

  if (!user) {
    return (
      <Routes>
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="*" element={<AuthPage mode="login" />} />
      </Routes>
    );
  }

  return (
    <Suspense fallback={<div className="p-8"><Spinner label="Loading…" /></div>}>
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="resumes" element={<Resumes />} />
        <Route path="analyses" element={<AnalysesPage />} />
        <Route path="analyses/:id" element={<AnalysisView />} />
        <Route path="interviews" element={<InterviewList />} />
        <Route path="interviews/new" element={<InterviewSetup />} />
        <Route path="interviews/:id" element={<InterviewRoom />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    </Suspense>
  );
}
