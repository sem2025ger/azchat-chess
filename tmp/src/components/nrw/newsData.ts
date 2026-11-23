export const regionLabels = {
 nrw: 'Nordrhein-Westfalen',
 ruhrgebiet: 'Ruhrgebiet',
 niederrhein: 'Niederrhein',
 mittelrhein: 'Mittelrhein',
 owl: 'Ostwestfalen-Lippe',
 muensterland: 'Münsterland',
 suedwestfalen: 'Südwestfalen',
 bochum: 'Bochum',
} as const;

export const categoryLabels = {
 landesverband: 'Landesverband',
 jugend_schule: 'Jugend & Schule',
 region: 'Regionen',
} as const;

export type NewsRegion = keyof typeof regionLabels;
export type NewsCategory = keyof typeof categoryLabels;
export type NewsLocale = 'de'|'en'|'az'|'tr'|'ua'|'ru';
export type News = {
 title: string;
 url: string;
 source: string;
 shortName: string;
 region: NewsRegion;
 category: NewsCategory;
 publishedAt: string | null;
};
export type NewsState = {
 news: News[];
 now: number;
 updatedAt: string | null;
 sourcesOk: number | null;
 newsLoading: boolean;
 newsError: boolean;
};

export const isRegion = (value: unknown): value is NewsRegion =>
 typeof value === 'string' && Object.hasOwn(regionLabels, value);
export const isCategory = (value: unknown): value is NewsCategory =>
 typeof value === 'string' && Object.hasOwn(categoryLabels, value);
export const isDate = (value: unknown): value is string =>
 typeof value === 'string' && Number.isFinite(Date.parse(value));

const locales = { de:'de-DE', en:'en-GB', az:'az-AZ', tr:'tr-TR', ua:'uk-UA', ru:'ru-RU' } as const;

export function newsDateFormats(language: NewsLocale) {
 const locale = locales[language];
 return {
  clock: new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }),
  absolute: new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' }),
  relative: new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }),
  number: new Intl.NumberFormat(locale),
 };
}

export function relativeNewsTime(formatter: Intl.RelativeTimeFormat, value: string, now: number) {
 const minutes = (Date.parse(value) - now) / 60_000;
 if (Math.abs(minutes) < 60) return formatter.format(Math.trunc(minutes), 'minute');
 if (Math.abs(minutes) < 24 * 60) return formatter.format(Math.trunc(minutes / 60), 'hour');
 return formatter.format(Math.trunc(minutes / (24 * 60)), 'day');
}
