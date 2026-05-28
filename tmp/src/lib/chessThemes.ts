export type BoardTheme = 'Classic Green' | 'Light Green' | 'Dark Green' | 'Classic Wood' | 'Dark Wood / Brown' | 'Premium Gold' | 'Obsidian / Dark' | 'Blue / Slate' | 'Premium Graphite Gold' | 'Modern Flat 2D';
export type PieceTheme = 'classic' | 'neo' | 'tournament' | 'wood' | 'glass' | 'marble' | 'premium' | 'flat2d' | 'cburnett-classic';

export const BOARD_THEMES: Record<BoardTheme, { light: string; dark: string }> = {
  'Classic Green': { light: 'bg-[#ebecd0]', dark: 'bg-[#739552]' },
  'Light Green': { light: 'bg-[#f0f1e0]', dark: 'bg-[#8ca86d]' },
  'Dark Green': { light: 'bg-[#d8d9c0]', dark: 'bg-[#5e7d3e]' },
  'Classic Wood': { light: 'theme-wood-light', dark: 'theme-wood-dark' },
  'Dark Wood / Brown': { light: 'bg-[#e3c16f]', dark: 'bg-[#8b4a1c]' },
  'Premium Gold': { light: 'bg-[#f3e4bd]', dark: 'bg-[#b8863b]' },
  'Obsidian / Dark': { light: 'bg-[#9ca3af]', dark: 'bg-[#1f2937]' },
  'Blue / Slate': { light: 'bg-[#e2e8f0]', dark: 'bg-[#475569]' },
  'Premium Graphite Gold': { light: 'bg-[#dfd3b6]', dark: 'bg-[#2c2c2c]' },
  'Modern Flat 2D': { light: 'bg-[#f1f5f9]', dark: 'bg-[#94a3b8]' }
};

export const PIECE_STYLES: { id: PieceTheme; name: string; preview: string }[] = [
  { id: 'classic', name: 'Classic Staunton', preview: 'wK' },
  { id: 'cburnett-classic', name: 'CBURNETT Classic', preview: 'wK' },
];

export const BOARD_THEME_DETAILS: { id: BoardTheme; name: string; color: string }[] = [
  { id: 'Classic Green', name: 'Classic Green', color: 'bg-[#739552]' },
  { id: 'Light Green', name: 'Light Green', color: 'bg-[#8ca86d]' },
  { id: 'Dark Green', name: 'Dark Green', color: 'bg-[#5e7d3e]' },
  { id: 'Classic Wood', name: 'Classic Wood', color: 'theme-wood-dark' },
  { id: 'Dark Wood / Brown', name: 'Dark Wood', color: 'bg-[#8b4a1c]' },
  { id: 'Premium Gold', name: 'Premium Gold', color: 'bg-[#b8863b]' },
  { id: 'Obsidian / Dark', name: 'Obsidian Night', color: 'bg-[#1f2937]' },
  { id: 'Blue / Slate', name: 'Blue Slate', color: 'bg-[#475569]' },
  { id: 'Premium Graphite Gold', name: 'Graphite Gold', color: 'bg-[#2c2c2c]' },
  { id: 'Modern Flat 2D', name: 'Modern Flat', color: 'bg-[#94a3b8]' },
];
