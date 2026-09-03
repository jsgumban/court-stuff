import { useEffect } from 'react';
import { Route, Routes } from 'react-router';
import { AuthGate } from './components/AuthGate';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/Toast';
import { requestPersistentStorage } from './lib/browser';
import { sync } from './sync/engine';
import NotFound from './pages/NotFound';
import PlayerPage from './pages/PlayerPage';
import PlayersPage from './pages/PlayersPage';
import SessionPage from './pages/SessionPage';
import NewSessionPage from './pages/NewSessionPage';
import SessionsPage from './pages/SessionsPage';
import SharedSessionPage from './pages/SharedSessionPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  useEffect(() => {
    void requestPersistentStorage();
    sync.start();
  }, []);

  return (
    <ToastProvider>
      <Routes>
        {/* Public, read-only: no account needed. */}
        <Route path="s/:token" element={<SharedSessionPage />} />
        <Route
          element={
            <AuthGate>
              <Layout />
            </AuthGate>
          }
        >
          <Route index element={<SessionsPage />} />
          <Route path="new" element={<NewSessionPage />} />
          <Route path="session/:id" element={<SessionPage />} />
          <Route path="players" element={<PlayersPage />} />
          <Route path="players/:id" element={<PlayerPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </ToastProvider>
  );
}
