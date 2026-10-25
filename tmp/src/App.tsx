import { lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Layout from './components/Layout';
import { supabase } from './services/supabase';
import MaintenancePage from './components/MaintenancePage';
import { routeLoaders } from './routeLoaders';

// Lazy-loaded Screens for code-splitting and fast initial load
const HomeScreen = lazy(routeLoaders.home);
const PlayRoute = lazy(routeLoaders.play);
const GameRoute = lazy(routeLoaders.game);
const ChatScreen = lazy(routeLoaders.chat);
const ProfileScreen = lazy(routeLoaders.profile);
const SettingsScreen = lazy(routeLoaders.settings);
const UpdatePasswordScreen = lazy(routeLoaders.updatePassword);

// Preserve recovery links even when Supabase uses the Site URL fallback.
function RecoveryRedirect() {
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const query = new URLSearchParams(window.location.search);
    const isRecovery = hash.get('type') === 'recovery' || query.get('type') === 'recovery';
    if (isRecovery && window.location.pathname !== '/update-password') {
      window.history.replaceState(null, '', '/update-password' + window.location.search + window.location.hash);
      window.location.reload();
    }
    void supabase.auth.getSession();
  }, []);
  return null;
}

// Keep the public maintenance gate active for production until separately authorized.
function App() {
  if (import.meta.env.VITE_MAINTENANCE_MODE === 'true' && window.location.pathname !== '/update-password') {
    return <MaintenancePage />;
  }

  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <SocketProvider>
            <RecoveryRedirect />
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Routes>
                  <Route path="/" element={<Layout />}>
                    <Route index element={<HomeScreen />} />
                    <Route path="home" element={<HomeScreen />} />
                    <Route path="play" element={<PlayRoute />} />
                    <Route path="game" element={<GameRoute />} />
                    <Route path="chat" element={<ChatScreen />} />
                    <Route path="profile" element={<ProfileScreen />} />
                    <Route path="settings" element={<SettingsScreen />} />
                    <Route path="update-password" element={<UpdatePasswordScreen />} />
                  </Route>
                </Routes>
            </BrowserRouter>
          </SocketProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
