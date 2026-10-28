import { useLanguage } from '../context/LanguageContext';

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
    "ua": "Завантажити партії гравця",
    "ru": "Загрузить партии игрока"
  },
  "Spielerpartien werden geladen …": {
    "de": "Spielerpartien werden geladen …",
    "en": "Loading player games…",
    "az": "Oyunçu partiyaları yüklənir…",
    "tr": "Oyuncu oyunları yükleniyor…",
    "ua": "Завантаження партій гравця…",
    "ru": "Загрузка партий игрока…"
  },
  "Farbe": {
    "de": "Farbe",
    "en": "Colour",
    "az": "Rəng",
    "tr": "Renk",
    "ua": "Колір",
    "ru": "Цвет"
  },
  "Beide Farben": {
    "de": "Beide Farben",
    "en": "Both colours",
    "az": "Hər iki rəng",
    "tr": "İki renk",
    "ua": "Обидва кольори",
    "ru": "Оба цвета"
  },
  "Weiß": {
    "de": "Weiß",
    "en": "White",
    "az": "Ağ",
    "tr": "Beyaz",
    "ua": "Білі",
    "ru": "Белые"
  },
  "Schwarz": {
    "de": "Schwarz",
    "en": "Black",
    "az": "Qara",
    "tr": "Siyah",
    "ua": "Чорні",
    "ru": "Чёрные"
  },
  "Bedenkzeit": {
    "de": "Bedenkzeit",
    "en": "Time control",
    "az": "Vaxt nəzarəti",
    "tr": "Zaman kontrolü",
    "ua": "Контроль часу",
    "ru": "Контроль времени"
  },
  "Alle Bedenkzeiten": {
    "de": "Alle Bedenkzeiten",
    "en": "All time controls",
    "az": "Bütün vaxt nəzarətləri",
    "tr": "Tüm zaman kontrolleri",
    "ua": "Усі контролі часу",
    "ru": "Все контроли времени"
  },
  "Zeitkontrolle": {
    "de": "Zeitkontrolle",
    "en": "Time control",
    "az": "Vaxt nəzarəti",
    "tr": "Zaman kontrolü",
    "ua": "Контроль часу",
    "ru": "Контроль времени"
  },
  "Alle Zeitkontrollen": {
    "de": "Alle Zeitkontrollen",
    "en": "All time controls",
    "az": "Bütün vaxt nəzarətləri",
    "tr": "Tüm zaman kontrolleri",
    "ua": "Усі контролі часу",
    "ru": "Все контроли времени"
  },
  "Eröffnung oder Variante (Name / ECO)": {
    "de": "Eröffnung oder Variante (Name / ECO)",
    "en": "Opening or variation (name / ECO)",
    "az": "Debüt və ya variant (ad / ECO)",
    "tr": "Açılış veya varyant (ad / ECO)",
    "ua": "Дебют або варіант (назва / ECO)",
    "ru": "Дебют или вариант (название / ECO)"
  },
  "Stellungen werden verglichen …": {
    "de": "Stellungen werden verglichen …",
    "en": "Comparing positions…",
    "az": "Mövqelər müqayisə edilir…",
    "tr": "Konumlar karşılaştırılıyor…",
    "ua": "Порівняння позицій…",
    "ru": "Сравнение позиций…"
  },
  "Ungültige Stellung": {
    "de": "Ungültige Stellung",
    "en": "Invalid position",
    "az": "Yanlış mövqe",
    "tr": "Geçersiz konum",
    "ua": "Неприпустима позиція",
    "ru": "Некорректная позиция"
  },
  "Was spielte der Spieler als Nächstes?": {
    "de": "Was spielte der Spieler als Nächstes?",
    "en": "What did the player play next?",
    "az": "Oyunçu sonra nə oynadı?",
    "tr": "Oyuncu sonra ne oynadı?",
    "ua": "Що гравець зіграв далі?",
    "ru": "Что игрок сыграл дальше?"
  },
  "Zug": {
    "de": "Zug",
    "en": "Move",
    "az": "Gediş",
    "tr": "Hamle",
    "ua": "Хід",
    "ru": "Ход"
  },
  "Partien": {
    "de": "Partien",
    "en": "Games",
    "az": "Partiyalar",
    "tr": "Oyunlar",
    "ua": "Партії",
    "ru": "Партии"
  },
  "Keine importierten Partien für diesen Spieler.": {
    "de": "Keine importierten Partien für diesen Spieler.",
    "en": "No imported games for this player.",
    "az": "Bu oyunçu üçün idxal olunmuş partiya yoxdur.",
    "tr": "Bu oyuncu için içe aktarılmış oyun yok.",
    "ua": "Для цього гравця немає імпортованих партій.",
    "ru": "Для этого игрока нет импортированных партий."
  },
  "Mit Weiß": {
    "de": "Mit Weiß",
    "en": "With White",
    "az": "Ağlarla",
    "tr": "Beyazlarla",
    "ua": "Білими",
    "ru": "Белыми"
  },
  "Mit Schwarz": {
    "de": "Mit Schwarz",
    "en": "With Black",
    "az": "Qaralarla",
    "tr": "Siyahlarla",
    "ua": "Чорними",
    "ru": "Чёрными"
  },
  "Siege": {
    "de": "Siege",
    "en": "Wins",
    "az": "Qələbələr",
    "tr": "Galibiyetler",
    "ua": "Перемоги",
    "ru": "Победы"
  },
  "Remis": {
    "de": "Remis",
    "en": "Draws",
    "az": "Heç-heçələr",
    "tr": "Beraberlikler",
    "ua": "Нічиї",
    "ru": "Ничьи"
  },
  "Niederlagen": {
    "de": "Niederlagen",
    "en": "Losses",
    "az": "Məğlubiyyətlər",
    "tr": "Mağlubiyetler",
    "ua": "Поразки",
    "ru": "Поражения"
  },
  "Eröffnung / ECO": {
    "de": "Eröffnung / ECO",
    "en": "Opening / ECO",
    "az": "Debüt / ECO",
    "tr": "Açılış / ECO",
    "ua": "Дебют / ECO",
    "ru": "Дебют / ECO"
  },
  "Sieg %": {
    "de": "Sieg %",
    "en": "Win %",
    "az": "Qələbə %",
    "tr": "Galibiyet %",
    "ua": "Перемоги %",
    "ru": "Победы %"
  },
  "Remis %": {
    "de": "Remis %",
    "en": "Draw %",
    "az": "Heç-heçə %",
    "tr": "Beraberlik %",
    "ua": "Нічиї %",
    "ru": "Ничьи %"
  },
  "Niederlage %": {
    "de": "Niederlage %",
    "en": "Loss %",
    "az": "Məğlubiyyət %",
    "tr": "Mağlubiyet %",
    "ua": "Поразки %",
    "ru": "Поражения %"
  },
  "In ChessAZ analysieren": {
    "de": "In ChessAZ analysieren",
    "en": "Analyse in ChessAZ",
    "az": "ChessAZ-da analiz et",
    "tr": "ChessAZ'da analiz et",
    "ua": "Аналізувати в ChessAZ",
    "ru": "Анализировать в ChessAZ"
  },
  "Quelldatei": {
    "de": "Quelldatei",
    "en": "Source file",
    "az": "Mənbə faylı",
    "tr": "Kaynak dosyası",
    "ua": "Файл джерела",
    "ru": "Файл источника"
  },
  "Aufstellung": {
    "de": "Aufstellung",
    "en": "Lineup",
    "az": "Heyət",
    "tr": "Kadro",
    "ua": "Склад",
    "ru": "Состав"
  },
  "Gegner": {
    "de": "Gegner",
    "en": "Opponent",
    "az": "Rəqib",
    "tr": "Rakip",
    "ua": "Суперник",
    "ru": "Соперник"
  },
  "Nach der Runde": {
    "de": "Nach der Runde",
    "en": "After the round",
    "az": "Turdan sonra",
    "tr": "Tur sonrası",
    "ua": "Після туру",
    "ru": "После тура"
  },
  "Termin bearbeiten": {
    "de": "Termin bearbeiten",
    "en": "Edit match date",
    "az": "Oyun tarixini redaktə et",
    "tr": "Maç tarihini düzenle",
    "ua": "Змінити дату матчу",
    "ru": "Изменить дату матча"
  },
  "Spieltermin eintragen": {
    "de": "Spieltermin eintragen",
    "en": "Add match date",
    "az": "Oyun tarixi əlavə et",
    "tr": "Maç tarihi ekle",
    "ua": "Додати дату матчу",
    "ru": "Добавить дату матча"
  },
  "Runde": {
    "de": "Runde",
    "en": "Round",
    "az": "Tur",
    "tr": "Tur",
    "ua": "Тур",
    "ru": "Тур"
  },
  "Gegnerische Mannschaft": {
    "de": "Gegnerische Mannschaft",
    "en": "Opponent team",
    "az": "Rəqib komanda",
    "tr": "Rakip takım",
    "ua": "Команда суперника",
    "ru": "Команда соперника"
  },
  "Gegnerischer Verein (optional)": {
    "de": "Gegnerischer Verein (optional)",
    "en": "Opponent club (optional)",
    "az": "Rəqib klub (istəyə bağlı)",
    "tr": "Rakip kulüp (isteğe bağlı)",
    "ua": "Клуб суперника (необов’язково)",
    "ru": "Клуб соперника (необязательно)"
  },
  "Ohne Verknüpfung": {
    "de": "Ohne Verknüpfung",
    "en": "No link",
    "az": "Əlaqə yoxdur",
    "tr": "Bağlantı yok",
    "ua": "Без прив’язки",
    "ru": "Без привязки"
  },
  "Datum und Uhrzeit (Deutschland)": {
    "de": "Datum und Uhrzeit (Deutschland)",
    "en": "Date and time (Germany)",
    "az": "Tarix və vaxt (Almaniya)",
    "tr": "Tarih ve saat (Almanya)",
    "ua": "Дата і час (Німеччина)",
    "ru": "Дата и время (Германия)"
  },
  "Spielort": {
    "de": "Spielort",
    "en": "Venue",
    "az": "Oyun yeri",
    "tr": "Maç yeri",
    "ua": "Місце гри",
    "ru": "Место игры"
  },
  "Termin speichern": {
    "de": "Termin speichern",
    "en": "Save match date",
    "az": "Oyun tarixini saxla",
    "tr": "Maç tarihini kaydet",
    "ua": "Зберегти дату матчу",
    "ru": "Сохранить дату матча"
  },
  "Abbrechen": {
    "de": "Abbrechen",
    "en": "Cancel",
    "az": "Ləğv et",
    "tr": "İptal",
    "ua": "Скасувати",
    "ru": "Отмена"
  },
  "Brett": {
    "de": "Brett",
    "en": "Board",
    "az": "Taxta",
    "tr": "Tahta",
    "ua": "Дошка",
    "ru": "Доска"
  },
  "Eigene Spielerin / eigener Spieler": {
    "de": "Eigene Spielerin / eigener Spieler",
    "en": "Home player",
    "az": "Öz oyunçumuz",
    "tr": "Kendi oyuncumuz",
    "ua": "Гравець своєї команди",
    "ru": "Игрок своей команды"
  },
  "Eigene FIDE-ID (optional)": {
    "de": "Eigene FIDE-ID (optional)",
    "en": "Home FIDE ID (optional)",
    "az": "Öz FIDE ID (istəyə bağlı)",
    "tr": "Kendi FIDE ID (isteğe bağlı)",
    "ua": "Свій FIDE ID (необов’язково)",
    "ru": "Свой FIDE ID (необязательно)"
  },
  "Gegnerin / Gegner": {
    "de": "Gegnerin / Gegner",
    "en": "Opponent player",
    "az": "Rəqib oyunçu",
    "tr": "Rakip oyuncu",
    "ua": "Гравець суперника",
    "ru": "Игрок соперника"
  },
  "Gegnerische FIDE-ID (optional)": {
    "de": "Gegnerische FIDE-ID (optional)",
    "en": "Opponent FIDE ID (optional)",
    "az": "Rəqib FIDE ID (istəyə bağlı)",
    "tr": "Rakip FIDE ID (isteğe bağlı)",
    "ua": "FIDE ID суперника (необов’язково)",
    "ru": "FIDE ID соперника (необязательно)"
  },
  "Brett speichern": {
    "de": "Brett speichern",
    "en": "Save board",
    "az": "Taxtanı saxla",
    "tr": "Tahtayı kaydet",
    "ua": "Зберегти дошку",
    "ru": "Сохранить доску"
  },
  "Eigene Aufstellung": {
    "de": "Eigene Aufstellung",
    "en": "Our lineup",
    "az": "Bizim heyət",
    "tr": "Bizim kadro",
    "ua": "Наш склад",
    "ru": "Наш состав"
  },
  "Bearbeiten": {
    "de": "Bearbeiten",
    "en": "Edit",
    "az": "Redaktə et",
    "tr": "Düzenle",
    "ua": "Редагувати",
    "ru": "Изменить"
  },
  "Brett entfernen": {
    "de": "Brett entfernen",
    "en": "Remove board",
    "az": "Taxtanı sil",
    "tr": "Tahtayı kaldır",
    "ua": "Видалити дошку",
    "ru": "Удалить доску"
  },
  "Ergebnis": {
    "de": "Ergebnis",
    "en": "Result",
    "az": "Nəticə",
    "tr": "Sonuç",
    "ua": "Результат",
    "ru": "Результат"
  },
  "Noch offen": {
    "de": "Noch offen",
    "en": "Pending",
    "az": "Hələ açıqdır",
    "tr": "Bekliyor",
    "ua": "Ще не завершено",
    "ru": "Ещё не завершено"
  },
  "Nicht gespielt": {
    "de": "Nicht gespielt",
    "en": "Not played",
    "az": "Oynanılmayıb",
    "tr": "Oynanmadı",
    "ua": "Не зіграно",
    "ru": "Не сыграно"
  },
  "Kurze Notizen": {
    "de": "Kurze Notizen",
    "en": "Brief notes",
    "az": "Qısa qeydlər",
    "tr": "Kısa notlar",
    "ua": "Короткі нотатки",
    "ru": "Короткие заметки"
  },
  "Notizen speichern": {
    "de": "Notizen speichern",
    "en": "Save notes",
    "az": "Qeydləri saxla",
    "tr": "Notları kaydet",
    "ua": "Зберегти нотатки",
    "ru": "Сохранить заметки"
  },
  "Noch keine Notizen.": {
    "de": "Noch keine Notizen.",
    "en": "No notes yet.",
    "az": "Hələ qeyd yoxdur.",
    "tr": "Henüz not yok.",
    "ua": "Нотаток ще немає.",
    "ru": "Заметок пока нет."
  },
  "Noch keine Bretter eingetragen.": {
    "de": "Noch keine Bretter eingetragen.",
    "en": "No boards entered yet.",
    "az": "Hələ taxtalar daxil edilməyib.",
    "tr": "Henüz tahta girilmedi.",
    "ua": "Дошки ще не внесено.",
    "ru": "Доски пока не добавлены."
  },
  "Noch nicht eingetragen": {
    "de": "Noch nicht eingetragen",
    "en": "Not entered yet",
    "az": "Hələ daxil edilməyib",
    "tr": "Henüz girilmedi",
    "ua": "Ще не внесено",
    "ru": "Ещё не добавлено"
  },
  "Spielerkarte": {
    "de": "Spielerkarte",
    "en": "Player card",
    "az": "Oyunçu kartı",
    "tr": "Oyuncu kartı",
    "ua": "Картка гравця",
    "ru": "Карточка игрока"
  },
  "Mannschaftskampf": {
    "de": "Mannschaftskampf",
    "en": "Team match",
    "az": "Komanda görüşü",
    "tr": "Takım maçı",
    "ua": "Командний матч",
    "ru": "Командный матч"
  },
  "Lichess-Konto": {
    "de": "Lichess-Konto",
    "en": "Lichess account",
    "az": "Lichess hesabı",
    "tr": "Lichess hesabı",
    "ua": "Акаунт Lichess",
    "ru": "Аккаунт Lichess"
  }
};

export function useRegionalCopy() {
  const { language } = useLanguage();
  return (label: string): string => regionalCopy[label]?.[language] || label;
}
