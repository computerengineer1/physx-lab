import { useEffect } from 'react';
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/shell/AppShell';
import { ToastProvider } from './components/ui/primitives';
import { DataProvider } from './state/data';
import { SettingsProvider } from './state/settings';
import { Dashboard } from './pages/Dashboard';
import { LibraryPage } from './pages/Library';
import { FormulaReferencePage } from './pages/FormulaReference';
import { MyExperimentsPage } from './pages/MyExperiments';
import { RevisionPage } from './pages/Revision';
import { SettingsPage } from './pages/Settings';
import { NotFoundPage } from './pages/NotFound';
import { ModulePage } from './modules/ModulePage';
import { MathReviewPage } from './modules/math-review/MathReviewPage';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <SettingsProvider>
      <DataProvider>
        <ToastProvider>
          <HashRouter>
            <ScrollToTop />
            <Routes>
              <Route element={<AppShell />}>
                <Route index element={<Dashboard />} />
                <Route path="library" element={<LibraryPage />} />
                <Route path="math-review" element={<MathReviewPage />} />
                <Route path="math-review/:tab" element={<MathReviewPage />} />
                <Route path="oscillatory-motion" element={<ModulePage moduleId="oscillatory-motion" />} />
                <Route path="oscillatory-motion/:tab" element={<ModulePage moduleId="oscillatory-motion" />} />
                <Route path="wave-motion" element={<ModulePage moduleId="wave-motion" />} />
                <Route path="wave-motion/:tab" element={<ModulePage moduleId="wave-motion" />} />
                <Route path="interference" element={<ModulePage moduleId="interference" />} />
                <Route path="interference/:tab" element={<ModulePage moduleId="interference" />} />
                <Route path="ray-optics" element={<ModulePage moduleId="ray-optics" />} />
                <Route path="ray-optics/:tab" element={<ModulePage moduleId="ray-optics" />} />
                <Route path="image-formation" element={<ModulePage moduleId="image-formation" />} />
                <Route path="image-formation/:tab" element={<ModulePage moduleId="image-formation" />} />
                <Route path="formulas" element={<FormulaReferencePage />} />
                <Route path="experiments" element={<MyExperimentsPage />} />
                <Route path="revision" element={<RevisionPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </HashRouter>
        </ToastProvider>
      </DataProvider>
    </SettingsProvider>
  );
}
