import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Layout from './components/Layout';

// Screens
import HomeScreen from './screens/HomeScreen';
import PlayScreen from './screens/PlayScreen';
import GameScreen from './screens/GameScreen';
import ChatScreen from './screens/ChatScreen';
import ProfileScreen from './screens/ProfileScreen';
import SettingsScreen from './screens/SettingsScreen';

function App() {
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
              <Route path="play" element={<PlayScreen />} />
              <Route path="game" element={<GameScreen />} />
              <Route path="chat" element={<ChatScreen />} />
              <Route path="profile" element={<ProfileScreen />} />
              <Route path="settings" element={<SettingsScreen />} />
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
