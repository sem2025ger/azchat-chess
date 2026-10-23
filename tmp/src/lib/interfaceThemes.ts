/** Optional midtone interface palettes. Existing themes remain unchanged. */
export const PREMIUM_INTERFACE_THEMES = {
  'Slate Blue': {
    className: 'bg-gradient-to-br from-[#53677c] via-[#465a70] to-[#3b4d62]',
    gradient: 'linear-gradient(145deg, #53677c, #465a70 52%, #3b4d62)',
  },
  'Sage Stone': {
    className: 'bg-gradient-to-br from-[#5e716a] via-[#4e625c] to-[#40554f]',
    gradient: 'linear-gradient(145deg, #5e716a, #4e625c 52%, #40554f)',
  },
  'Warm Taupe': {
    className: 'bg-gradient-to-br from-[#7a6b5e] via-[#6b5c51] to-[#594d45]',
    gradient: 'linear-gradient(145deg, #7a6b5e, #6b5c51 52%, #594d45)',
  },
  'Amethyst Mist': {
    className: 'bg-gradient-to-br from-[#70657f] via-[#60556f] to-[#50475f]',
    gradient: 'linear-gradient(145deg, #70657f, #60556f 52%, #50475f)',
  },
} as const;

export type PremiumInterfaceTheme = keyof typeof PREMIUM_INTERFACE_THEMES;
export const premiumInterfaceThemes = Object.entries(PREMIUM_INTERFACE_THEMES).map(([id, palette]) => ({
  id: id as PremiumInterfaceTheme, name: id, class: palette.className, gradient: palette.gradient,
}));
