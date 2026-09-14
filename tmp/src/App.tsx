import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Layout from './components/Layout';
import MaintenancePage from './components/MaintenancePage';

// Lazy-loaded Screens for code-splitting and fast initial load
const HomeScreen = lazy(() => import('./screens/HomeScreen'));
const PlayRoute = lazy(() => import('./screens/PlayRoute'));
const GameRoute = lazy(() => import('./screens/GameRoute'));
const ChatScreen = lazy(() => import('./screens/ChatScreen'));
const ProfileScreen = lazy(() => import('./screens/ProfileScreen'));
const SettingsScreen = lazy(() => import('./screens/SettingsScreen'));
const UpdatePasswordScreen = lazy(() => import('./screens/UpdatePasswordScreen'));

function RouteLoadingFallback() {
  return (
    <div className="flex-1 min-h-[50vh] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-chess-active/20 border-t-chess-active animate-spin" />
    </div>
  );
}

function App() {
  if (import.meta.env.VITE_MAINTENANCE_MODE === 'true') {
    return <MaintenancePage />;
  }

  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <SocketProvider>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <Suspense fallback={<RouteLoadingFallback />}>
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
              </Suspense>
            </BrowserRouter>
          </SocketProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
