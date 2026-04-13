import { createContext, useContext, useState, type ReactNode } from 'react';

// Defines the options
export type BackgroundTheme = 'Standard' | 'Game Room' | 'Classic Wood' | 'Modern Glass';
export type PieceTheme = 'neo' | 'classic' | 'wood' | 'glass' | 'marble' | 'tournament';
export type BoardTheme = 'Green' | 'Wood' | 'Glass' | 'Brown' | 'Ice Sea' | 'Newspaper' | 'Walnut' | 'Sky' | 'Lolz' | 'Stone' | 'Warm Gold' | 'Muted Gold' | 'Obsidian Gold' | 'Charcoal Gold' | 'Champagne' | 'Luxury Beige' | 'Ivory' | 'Tournament' | 'Blue Steel' | 'Marble Sand';
export type SoundTheme = 'Default' | 'Nature' | 'Metal' | 'Marble' | 'Space' | 'Beat' | 'Lolz' | 'Newspaper' | 'Pebble' | 'Events / Esports World Cup';

interface ThemeContextType {
  specialThemesEnabled: boolean;
  setSpecialThemesEnabled: (val: boolean) => void;
  background: BackgroundTheme;
  setBackground: (val: BackgroundTheme) => void;
  pieces: PieceTheme;
  setPieces: (val: PieceTheme) => void;
  board: BoardTheme;
  setBoard: (val: BoardTheme) => void;
  sound: SoundTheme;
  setSound: (val: SoundTheme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [specialThemesEnabled, setSpecialThemesEnabled] = useState(true);
  const [background, setBackground] = useState<BackgroundTheme>('Game Room');
  const [pieces, setPieces] = useState<PieceTheme>('classic');
  const [board, setBoard] = useState<BoardTheme>('Obsidian Gold');
  const [sound, setSound] = useState<SoundTheme>('Default');

  return (
    <ThemeContext.Provider value={{
      specialThemesEnabled, setSpecialThemesEnabled,
      background, setBackground,
      pieces, setPieces,
      board, setBoard,
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
