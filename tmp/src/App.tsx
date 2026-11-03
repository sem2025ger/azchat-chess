import { lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Layout from './components/Layout';
import MaintenancePage from './components/MaintenancePage';
const ClubInviteScreen = lazy(() => import('./screens/ClubInviteScreen'));
import { routeLoaders } from './routeLoaders';

// Lazy-loaded Screens for code-splitting and fast initial load
const HomeScreen = lazy(routeLoaders.home);
const PlayRoute = lazy(routeLoaders.play);
const GameRoute = lazy(routeLoaders.game);
const ChatScreen = lazy(routeLoaders.chat);
const ProfileScreen = lazy(routeLoaders.profile);
const SettingsScreen = lazy(routeLoaders.settings);
const UpdatePasswordScreen = lazy(routeLoaders.updatePassword);
const ClubsNRWScreen = lazy(routeLoaders.clubsNrw);
const RegionOverview = lazy(routeLoaders.regionNw);
const SpieltagScreen = lazy(routeLoaders.spieltag);
const VorbereitungScreen = lazy(routeLoaders.vorbereitung);
const SpielerScreen = lazy(routeLoaders.spieler);

// Keep the public maintenance gate active for production until separately authorized.
function App() {
  // A full production hold: no application route (including password recovery)
  // renders while maintenance mode is enabled on either desktop or mobile.
  if (import.meta.env.VITE_MAINTENANCE_MODE === 'true') {
    return <MaintenancePage />;
  }

  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <SocketProvider>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Routes>
                  <Route path="/" element={<Layout />}>
                    <Route index element={<HomeScreen />} />
                    <Route path="home" element={<HomeScreen />} />
                    <Route path="play" element={<PlayRoute />} />
                    <Route path="game" element={<GameRoute />} />
                    <Route path="chat" element={<ChatScreen />} />
                    <Route path="schach-treff/einladung/:token" element={<ClubInviteScreen />} />
                    <Route path="profile" element={<ProfileScreen />} />
                    <Route path="settings" element={<SettingsScreen />} />
                    {import.meta.env.VITE_SPIELER_V1_ENABLED === 'true' && <Route path="spieler" element={<SpielerScreen />} />}
                    <Route path="update-password" element={<UpdatePasswordScreen />} />
                    {import.meta.env.VITE_SPIELTAG_ENABLED === 'true' && <Route path="spieltag" element={<SpieltagScreen />} />}
                    {import.meta.env.VITE_VORBEREITUNG_ENABLED === 'true' && <Route path="vorbereitung" element={<VorbereitungScreen />} />}
                    {import.meta.env.VITE_CLUBS_NRW_ENABLED === 'true' && <Route path="region/:regionId" element={<RegionOverview />} />}
                    {import.meta.env.VITE_CLUBS_NRW_ENABLED === 'true' && <Route path="region/:regionId/:section" element={<RegionOverview />} />}
                    {import.meta.env.VITE_CLUBS_NRW_ENABLED === 'true' && <Route path="clubs-nrw" element={<ClubsNRWScreen />} />}
                    {import.meta.env.VITE_CLUBS_NRW_ENABLED === 'true' && <Route path="clubs-nrw/:slug" element={<ClubsNRWScreen />} />}
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
