import { useEffect } from 'react';
import { Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/Toast';
import { requestPersistentStorage } from './lib/browser';
import NotFound from './pages/NotFound';
import PlayerPage from './pages/PlayerPage';
import PlayersPage from './pages/PlayersPage';
import SessionPage from './pages/SessionPage';
import SessionsPage from './pages/SessionsPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  return (
    <ToastProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<SessionsPage />} />
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
