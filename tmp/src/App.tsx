import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Layout from './components/Layout';
import MaintenancePage from './components/MaintenancePage';

// Screens
import HomeScreen from './screens/HomeScreen';
import PlayRoute from './screens/PlayRoute';
import GameRoute from './screens/GameRoute';
import ChatScreen from './screens/ChatScreen';
import ProfileScreen from './screens/ProfileScreen';
import SettingsScreen from './screens/SettingsScreen';
import UpdatePasswordScreen from './screens/UpdatePasswordScreen';

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
