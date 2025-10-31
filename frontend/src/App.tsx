import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import LandingPage from './pages/LandingPage';
import RecordPage from './pages/RecordPage';
import ProcessingPage from './pages/ProcessingPage';
import ResultPage from './pages/ResultPage';
import RamblesListPage from './pages/RamblesListPage';
import AuthCallback from './pages/AuthCallback';

function App() {
  const { fetchUser } = useAuthStore();

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return (
    <div className="h-full">
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/record" element={<RecordPage />} />
        <Route path="/processing/:id" element={<ProcessingPage />} />
        <Route path="/result/:id" element={<ResultPage />} />
        <Route path="/rambles" element={<RamblesListPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
      </Routes>
    </div>
  );
}

export default App;
