import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

import type { BoardTheme, PieceTheme } from '../lib/chessThemes';

// Defines the options
export type BackgroundTheme = 'Void Black' | 'Deep Space' | 'Velvet Gold' | 'Champagne Light' | 'Coffee Brown' | 'Walnut Dark' | 'Emerald Night' | 'Royal Blue' | 'Royal Violet' | 'Obsidian Gold';
export type SoundTheme = 'Default' | 'Soft' | 'Classic' | 'Muted / Off';

interface ThemeContextType {
  specialThemesEnabled: boolean;
  setSpecialThemesEnabled: (val: boolean) => void;
  background: BackgroundTheme;
  setBackground: (val: BackgroundTheme) => void;
  pieceTheme: PieceTheme;
  setPieceTheme: (val: PieceTheme) => void;
  boardTheme: BoardTheme;
  setBoardTheme: (val: BoardTheme) => void;
  sound: SoundTheme;
  setSound: (val: SoundTheme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [specialThemesEnabled, setSpecialThemesEnabled] = useState(() => {
    const saved = localStorage.getItem('chess_specialThemesEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  });
  
  const [background, setBackground] = useState<BackgroundTheme>(() => {
    const saved = localStorage.getItem('chess_background');
    if (saved === 'Standard') return 'Void Black';
    if (saved === 'Game Room') return 'Deep Space';
    if (saved === 'Velvet Gold Background') return 'Velvet Gold';
    const validThemes = ['Void Black', 'Deep Space', 'Velvet Gold', 'Champagne Light', 'Coffee Brown', 'Walnut Dark', 'Emerald Night', 'Royal Blue', 'Royal Violet', 'Obsidian Gold'];
    if (saved && validThemes.includes(saved)) return saved as BackgroundTheme;
    return 'Void Black';
  });
  
  const [pieceTheme, setPieceTheme] = useState<PieceTheme>(() => {
    return (localStorage.getItem('chess_pieceTheme') as PieceTheme) || 'neo';
  });
  
  const [boardTheme, setBoardTheme] = useState<BoardTheme>(() => {
    return (localStorage.getItem('chess_boardTheme') as BoardTheme) || 'Classic Wood';
  });
  
  const [sound, setSound] = useState<SoundTheme>(() => {
    return (localStorage.getItem('chess_sound') as SoundTheme) || 'Default';
  });

  useEffect(() => { localStorage.setItem('chess_specialThemesEnabled', JSON.stringify(specialThemesEnabled)); }, [specialThemesEnabled]);
  useEffect(() => { localStorage.setItem('chess_background', background); }, [background]);
  useEffect(() => { localStorage.setItem('chess_pieceTheme', pieceTheme); }, [pieceTheme]);
  useEffect(() => { localStorage.setItem('chess_boardTheme', boardTheme); }, [boardTheme]);
  useEffect(() => { localStorage.setItem('chess_sound', sound); }, [sound]);

  return (
    <ThemeContext.Provider value={{
      specialThemesEnabled, setSpecialThemesEnabled,
      background, setBackground,
      pieceTheme, setPieceTheme,
      boardTheme, setBoardTheme,
      sound, setSound
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useThemeContext must be used within ThemeProvider");
  return context;
}
