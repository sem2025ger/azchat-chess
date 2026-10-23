/** Pure, dependency-free setting search; kept outside React for instant filtering and regression tests. */
export type SettingKind = 'board' | 'pieces' | 'sound' | 'background';
export type SettingEntry = { kind: SettingKind; label: string; value: string };

const CATEGORY_TERMS: Record<SettingKind, string> = {
  board: 'board chessboard doska доска шахматная шахівниця brett lövhə tahta squares клетки xanalar',
  pieces: 'pieces figures piece фигуры фигур figuren fiqurlar taşlar daşlar набор',
  sound: 'sound audio volume mute звук звуки ses səs ton tonlautstärke звук',
  background: 'background appearance interface фон интерфейс оформление hintergrund oberfläche görünüş arkaplan görünüm mövzu tema темы',
};
const VALUE_TERMS: Record<string, string> = {
  'Classic Green': 'зелёный зеленый зелёная зеленая grün gruen yaşıl yeşil classic',
  'Light Green': 'зелёный зеленый зелёная зеленая светло зелёный grün hellgrün yaşıl yeşil light',
  'Dark Green': 'зелёный зеленый зелёная зеленая тёмно зелёный dunkelgrün yaşıl yeşil dark',
  'Classic Wood': 'дерево деревянная деревянный древесный holz ahşap taxta klassisch',
  'Dark Wood / Brown': 'дерево деревянная коричневый braun dunkel holz ahşap qəhvəyi',
  'Premium Gold': 'золото золотой золотая gold golden goldene qızıl altın',
  'Premium Graphite Gold': 'графит graphite графитовый золото золотой gold qrafit',
  'Obsidian / Dark': 'обсидиан черный чёрный schwarz dark black obsidian',
  'Blue / Slate': 'голубой синий blue blau mavi',
  'Modern Flat 2D': 'плоский flat modern moderne',
  'cburnett-classic': 'cburnett classic klassisch',
  neo: 'merida flat меридa neo',
  tournament: 'merida classic турнир tournament',
  classic: 'staunton classic стандарт классика',
  'Muted / Off': 'без звука тихо выкл stumm mute sessiz səssiz',
  Soft: 'мягкий тихий leise weich yumşaq yumuşak',
  Wood: 'дерево деревянный holz ahşap taxta',
  Crystal: 'кристалл crystal kristall kristal',
  'Void Black': 'чёрный черный black schwarz kara qara',
  'Deep Space': 'космос space weltraum',
  'Velvet Gold': 'золото золотой gold qızılı altın',
  'Champagne Light': 'светлый светлая hell champagner',
  'Coffee Brown': 'кофейный коричневый braun kahve',
  'Walnut Dark': 'орех тёмный nuss dunkel',
  'Emerald Night': 'изумруд зелёный зеленый smaragd green',
  'Royal Blue': 'синий blue blau',
  'Royal Violet': 'фиолетовый purple violett mor',
  'Obsidian Gold': 'обсидиан золото золотой gold',
  'Slate Blue': 'синий серый сланец blau grau mavi boz',
  'Sage Stone': 'шалфей зелёный зеленый salbei grün yaşıl yeşil',
  'Warm Taupe': 'тёплый теплый коричневый серый warm braun grau qəhvəyi kahverengi',
  'Amethyst Mist': 'аметист фиолетовый сиреневый amethyst violett bənövşəyi mor',
};

/** Diacritic-insensitive matching, including ё/е and ü/u. All tokens must match the specific entry. */
const normalize = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase().trim();

export function findSettings(entries: SettingEntry[], search: string, names: Record<SettingKind, string>, max = 12): SettingEntry[] {
  const tokens = normalize(search).split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  return entries.filter(entry => {
    const value = normalize([entry.label, entry.value, names[entry.kind], CATEGORY_TERMS[entry.kind], VALUE_TERMS[entry.value] || ''].join(' '));
    return tokens.every(token => value.includes(token));
  }).slice(0, max);
}

export const STYLE_PRESETS = {
  blitz: { board: 'Dark Green', pieces: 'neo', sound: 'Soft', background: 'Void Black' },
  study: { board: 'Light Green', pieces: 'cburnett-classic', sound: 'Soft', background: 'Deep Space' },
  focus: { board: 'Premium Graphite Gold', pieces: 'cburnett-classic', sound: 'Default', background: 'Obsidian Gold' },
} as const;
