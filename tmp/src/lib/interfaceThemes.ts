/** Optional muted dark interface palettes (approximately 50% lower HSL lightness). Existing themes remain unchanged. */
export const PREMIUM_INTERFACE_THEMES = {
  'Dark Graphite': {
    className: 'bg-[#1b1b19]',
    gradient: 'linear-gradient(145deg, #1b1b19, #1b1b19)',
  },
  'Deep Graphite': {
    className: 'bg-[#22221f]',
    gradient: 'linear-gradient(145deg, #22221f, #22221f)',
  },
  'Warm Graphite': {
    className: 'bg-[#2b2a27]',
    gradient: 'linear-gradient(145deg, #2b2a27, #2b2a27)',
  },
  'Slate Blue': {
    className: 'bg-gradient-to-br from-[#2a343e] via-[#232d38] to-[#1e2631]',
    gradient: 'linear-gradient(145deg, #2a343e, #232d38 52%, #1e2631)',
  },
  'Sage Stone': {
    className: 'bg-gradient-to-br from-[#2f3835] via-[#27312e] to-[#202a28]',
    gradient: 'linear-gradient(145deg, #2f3835, #27312e 52%, #202a28)',
  },
  'Warm Taupe': {
    className: 'bg-gradient-to-br from-[#3d362f] via-[#362e28] to-[#2c2622]',
    gradient: 'linear-gradient(145deg, #3d362f, #362e28 52%, #2c2622)',
  },
  'Amethyst Mist': {
    className: 'bg-gradient-to-br from-[#383240] via-[#302a38] to-[#282430]',
    gradient: 'linear-gradient(145deg, #383240, #302a38 52%, #282430)',
  },
} as const;

export type PremiumInterfaceTheme = keyof typeof PREMIUM_INTERFACE_THEMES;
export const premiumInterfaceThemes = Object.entries(PREMIUM_INTERFACE_THEMES).map(([id, palette]) => ({
  id: id as PremiumInterfaceTheme, name: id, class: palette.className, gradient: palette.gradient,
}));
