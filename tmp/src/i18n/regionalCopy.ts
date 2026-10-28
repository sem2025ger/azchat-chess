import { translateSectionCopy } from './sectionCopy';
import { useOptionalLanguage } from '../context/LanguageContext';

// Only fixed UI labels are localized; player names, club names, chat text, PGN and FIDE data are never translated.
const regionalCopy: Record<string, Record<string, string>> = {
  "Spieler nach echtem Namen finden": {
    "de": "Spieler nach echtem Namen finden",
    "en": "Find players by real name",
    "az": "Oyunçunu həqiqi adla tap",
    "tr": "Oyuncuyu gerçek adıyla bul",
    "ua": "Знайти гравця за справжнім ім’ям",
    "ru": "Найти игрока по настоящему имени"
  },
  "Spielername (Nachname, Vorname)": {
    "de": "Spielername (Nachname, Vorname)",
    "en": "Player name (last, first)",
    "az": "Oyunçunun adı (soyad, ad)",
    "tr": "Oyuncu adı (soyadı, adı)",
    "ua": "Ім’я гравця (прізвище, ім’я)",
    "ru": "Имя игрока (фамилия, имя)"
  },
  "FIDE-ID (optional)": {
    "de": "FIDE-ID (optional)",
    "en": "FIDE ID (optional)",
    "az": "FIDE ID (istəyə bağlı)",
    "tr": "FIDE ID (isteğe bağlı)",
    "ua": "FIDE ID (необов’язково)",
    "ru": "FIDE ID (необязательно)"
  },
  "Spielerpartien laden": {
    "de": "Spielerpartien laden",
    "en": "Load player games",
    "az": "Oyunçunun partiyalarını yüklə",
    "tr": "Oyuncunun oyunlarını yükle",
    "ua": "Завантажити партії г���q�^