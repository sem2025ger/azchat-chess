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
  },
  "FIDE-Verknüpfungen werden manuell eingetragen. Eine Verknüpfung bestätigt keine Identität.": {
    "de": "FIDE-Verknüpfungen werden manuell eingetragen. Eine Verknüpfung bestätigt keine Identität.",
    "en": "FIDE links are entered manually and do not verify identity.",
    "az": "FIDE əlaqələri əl ilə daxil edilir və şəxsiyyəti təsdiqləmir.",
    "tr": "FIDE bağlantıları elle girilir, kimliği doğrulamaz.",
    "ua": "Зв’язки FIDE додають вручну; вони не підтверджують особу.",
    "ru": "Привязки FIDE добавляются вручную и не подтверждают личность."
  },
  "Ergebnisse aus eigener Mannschaftssicht": {
    "de": "Ergebnisse aus eigener Mannschaftssicht",
    "en": "Results from our team's perspective",
    "az": "Komandamız baxımından nəticələr",
    "tr": "Takımımız açısından sonuçlar",
    "ua": "Результати з боку нашої команди",
    "ru": "Результаты с точки зрения нашей команды"
  },
  "Gegner offen": {
    "de": "Gegner offen",
    "en": "Opponent unknown",
    "az": "Rəqib məlum deyil",
    "tr": "Rakip belli değil",
    "ua": "Суперник невідомий",
    "ru": "Соперник неизвестен"
  },
  "1–0 · eigener Sieg": {
    "de": "1–0 · eigener Sieg",
    "en": "1–0 · home win",
    "az": "1–0 · bizim qələbəmiz",
    "tr": "1–0 · galibiyetimiz",
    "ua": "1–0 · наша перемога",
    "ru": "1–0 · наша победа"
  },
  "0–1 · eigene Niederlage": {
    "de": "0–1 · eigene Niederlage",
    "en": "0–1 · home loss",
    "az": "0–1 · bizim məğlubiyyətimiz",
    "tr": "0–1 · mağlubiyetimiz",
    "ua": "0–1 · наша поразка",
    "ru": "0–1 · наше поражение"
  },
  "½–½ · Remis": {
    "de": "½–½ · Remis",
    "en": "½–½ · draw",
    "az": "½–½ · heç-heçə",
    "tr": "½–½ · beraberlik",
    "ua": "½–½ · нічия",
    "ru": "½–½ · ничья"
  },
  "Manuell gepflegt. Keine Übertragung in Online-Partien, Ratings oder Ligatabellen.": {
    "de": "Manuell gepflegt. Keine Übertragung in Online-Partien, Ratings oder Ligatabellen.",
    "en": "Maintained manually. Does not affect online games, ratings or league standings.",
    "az": "Əl ilə yenilənir. Onlayn partiyalara, reytinqə və liqa cədvəlinə təsir etmir.",
    "tr": "Elle tutulur. Çevrimiçi oyunları, puanları veya lig tablolarını etkilemez.",
    "ua": "Оновлюється вручну. Не впливає на онлайн-партії, рейтинг чи таблиці ліг.",
    "ru": "Обновляется вручную. Не влияет на онлайн-партии, рейтинг и таблицы лиг."
  },
  "Spieltermin bearbeiten": {
    "de": "Spieltermin bearbeiten",
    "en": "Edit match date",
    "az": "Oyun tarixini redaktə et",
    "tr": "Maç tarihini düzenle",
    "ua": "Змінити дату матчу",
    "ru": "Изменить дату матча"
  },
  "Aufstellung bearbeiten": {
    "de": "Aufstellung bearbeiten",
    "en": "Edit lineup",
    "az": "Heyəti redaktə et",
    "tr": "Kadroyu düzenle",
    "ua": "Редагувати склад",
    "ru": "Изменить состав"
  },
  "Bitte wähle eine gültige, eindeutige Uhrzeit außerhalb der Zeitumstellung.": {
    "de": "Bitte wähle eine gültige, eindeutige Uhrzeit außerhalb der Zeitumstellung.",
    "en": "Choose a valid, unambiguous time outside the daylight-saving transition.",
    "az": "Saat dəyişikliyi xaricində düzgün, birmənalı vaxt seçin.",
    "tr": "Yaz saati geçişi dışında geçerli ve açık bir saat seçin.",
    "ua": "Оберіть коректний час поза переходом на літній час.",
    "ru": "Выберите корректное время вне перехода на летнее время."
  },
  "TWIC und offizielle Lichess-Broadcasts · Zuordnung bevorzugt über FIDE-ID.": {
    "de": "TWIC und offizielle Lichess-Broadcasts · Zuordnung bevorzugt über FIDE-ID.",
    "en": "TWIC and official Lichess broadcasts · FIDE ID matching preferred.",
    "az": "TWIC və rəsmi Lichess yayımları · FIDE ID üstün tutulur.",
    "tr": "TWIC ve resmi Lichess yayınları · FIDE ID öncelikli.",
    "ua": "TWIC та офіційні трансляції Lichess · перевага FIDE ID.",
    "ru": "TWIC и официальные трансляции Lichess · приоритет FIDE ID."
  },
  "importierte Partien": {
    "de": "importierte Partien",
    "en": "imported games",
    "az": "idxal edilmiş partiyalar",
    "tr": "içe aktarılan oyunlar",
    "ua": "імпортованих партій",
    "ru": "импортированных партий"
  },
  "Namenszuordnung (nicht verifiziert)": {
    "de": "Namenszuordnung (nicht verifiziert)",
    "en": "Name match (unverified)",
    "az": "Ad uyğunluğu (təsdiqlənməyib)",
    "tr": "İsim eşleşmesi (doğrulanmadı)",
    "ua": "Збіг імені (не підтверджено)",
    "ru": "Совпадение имени (не подтверждено)"
  },
  "ungültige oder nicht abgeschlossene Partien ausgelassen.": {
    "de": "ungültige oder nicht abgeschlossene Partien ausgelassen.",
    "en": "invalid or unfinished games excluded.",
    "az": "yanlış və ya bitməmiş partiyalar çıxarıldı.",
    "tr": "geçersiz veya bitmemiş oyunlar çıkarıldı.",
    "ua": "некоректні або незавершені партії пропущено.",
    "ru": "некорректных или незавершённых партий пропущено."
  },
  "Exakte Namensübereinstimmungen ohne FIDE-ID sind nicht verifiziert.": {
    "de": "Exakte Namensübereinstimmungen ohne FIDE-ID sind nicht verifiziert.",
    "en": "Exact name matches without FIDE ID are unverified.",
    "az": "FIDE ID olmadan dəqiq ad uyğunluqları təsdiqlənməyib.",
    "tr": "FIDE ID olmadan tam isim eşleşmeleri doğrulanmamıştır.",
    "ua": "Точні збіги імен без FIDE ID не підтверджено.",
    "ru": "Точные совпадения имён без FIDE ID не подтверждены."
  },
  "Partien erreichten diese Stellung": {
    "de": "Partien erreichten diese Stellung",
    "en": "games reached this position",
    "az": "partiya bu mövqeyə çatdı",
    "tr": "oyun bu konuma ulaştı",
    "ua": "партій досягли цієї позиції",
    "ru": "партий достигли этой позиции"
  },
  "Nächste Züge des gesuchten Spielers:": {
    "de": "Nächste Züge des gesuchten Spielers:",
    "en": "Next moves by the selected player:",
    "az": "Seçilmiş oyunçunun növbəti gedişləri:",
    "tr": "Seçilen oyuncunun sonraki hamleleri:",
    "ua": "Наступні ходи вибраного гравця:",
    "ru": "Следующие ходы выбранного игрока:"
  },
  "Gegnerzüge werden nicht als seine Züge gezählt.": {
    "de": "Gegnerzüge werden nicht als seine Züge gezählt.",
    "en": "Opponent moves are not counted as their moves.",
    "az": "Rəqibin gedişləri oyunçunun gedişi sayılmır.",
    "tr": "Rakip hamleleri oyuncunun hamleleri sayılmaz.",
    "ua": "Ходи суперника не враховуються як його ходи.",
    "ru": "Ходы соперника не считаются его ходами."
  },
  "Lichess-Broadcastdaten:": {
    "de": "Lichess-Broadcastdaten:",
    "en": "Lichess broadcast data:",
    "az": "Lichess yayım məlumatları:",
    "tr": "Lichess yayın verileri:",
    "ua": "Дані трансляцій Lichess:",
    "ru": "Данные трансляций Lichess:"
  },
  "Kommentare wurden beim Import entfernt.": {
    "de": "Kommentare wurden beim Import entfernt.",
    "en": "Comments were removed during import.",
    "az": "Şərhlər idxal zamanı silinib.",
    "tr": "Yorumlar içe aktarılırken kaldırıldı.",
    "ua": "Коментарі видалено під час імпорту.",
    "ru": "Комментарии удалены при импорте."
  },
  "Zuordnung über FIDE-ID": {
    "de": "Zuordnung über FIDE-ID",
    "en": "Matched by FIDE ID",
    "az": "FIDE ID ilə uyğunlaşdırılıb",
    "tr": "FIDE ID ile eşleştirildi",
    "ua": "Збіг за FIDE ID",
    "ru": "Совпадение по FIDE ID"
  },
  "Keine Partien in dieser Variante": {
    "de": "Keine Partien in dieser Variante",
    "en": "No games in this variation",
    "az": "Bu variantda partiya yoxdur",
    "tr": "Bu varyantta oyun yok",
    "ua": "Немає партій у цьому варіанті",
    "ru": "Нет партий в этом варианте"
  },
  "Keine Partien für diese Filter": {
    "de": "Keine Partien für diese Filter",
    "en": "No games for these filters",
    "az": "Bu filtrlərə uyğun partiya yoxdur",
    "tr": "Bu filtreler için oyun yok",
    "ua": "За цими фільтрами немає партій",
    "ru": "По этим фильтрам партий нет"
  },
  "passende Partien": {
    "de": "passende Partien",
    "en": "matching games",
    "az": "uyğun partiyalar",
    "tr": "eşleşen oyunlar",
    "ua": "відповідних партій",
    "ru": "подходящих партий"
  },
  "geladene Partien": {
    "de": "geladene Partien",
    "en": "loaded games",
    "az": "yüklənmiş partiyalar",
    "tr": "yüklenen oyunlar",
    "ua": "завантажених партій",
    "ru": "загруженных партий"
  },
  "Eröffnungen nach Farbe · Ergebnisse aus Sicht des gesuchten Spielers": {
    "de": "Eröffnungen nach Farbe · Ergebnisse aus Sicht des gesuchten Spielers",
    "en": "Openings by colour · results from the selected player's perspective",
    "az": "Rəngə görə debütlər · seçilmiş oyunçunun nəticələri",
    "tr": "Renge göre açılışlar · seçilen oyuncu açısından sonuçlar",
    "ua": "Дебюти за кольором · результати вибраного гравця",
    "ru": "Дебюты по цвету · результаты выбранного игрока"
  },
  "Nur für deine Mannschaft. Ein leerer Name entfernt die Zuordnung.": {
    "de": "Nur für deine Mannschaft. Ein leerer Name entfernt die Zuordnung.",
    "en": "For your team only. Empty name removes the link.",
    "az": "Yalnız komandanız üçün. Boş ad əlaqəni silir.",
    "tr": "Yalnızca takımınız için. Boş ad bağlantıyı kaldırır.",
    "ua": "Лише для вашої команди. Порожнє ім’я прибирає прив’язку.",
    "ru": "Только для вашей команды. Пустое имя удаляет привязку."
  },
  "Lichess-Benutzername des Gegners (nicht verifiziert)": {
    "de": "Lichess-Benutzername des Gegners (nicht verifiziert)",
    "en": "Opponent's Lichess username (unverified)",
    "az": "Rəqibin Lichess adı (təsdiqlənməyib)",
    "tr": "Rakibin Lichess adı (doğrulanmadı)",
    "ua": "Ім’я суперника в Lichess (не підтверджено)",
    "ru": "Имя соперника на Lichess (не подтверждено)"
  },
  "Lichess-Zuordnung speichern": {
    "de": "Lichess-Zuordnung speichern",
    "en": "Save Lichess link",
    "az": "Lichess əlaqəsini saxla",
    "tr": "Lichess bağlantısını kaydet",
    "ua": "Зберегти прив’язку Lichess",
    "ru": "Сохранить привязку Lichess"
  },
  "(nicht verifiziert)": {
    "de": "(nicht verifiziert)",
    "en": "(unverified)",
    "az": "(təsdiqlənməyib)",
    "tr": "(doğrulanmadı)",
    "ua": "(не підтверджено)",
    "ru": "(не подтверждено)"
  },
  "Lichess-Konto vorbereiten": {
    "de": "Lichess-Konto vorbereiten",
    "en": "Prepare Lichess account",
    "az": "Lichess hesabına hazırlaş",
    "tr": "Lichess hesabına hazırlan",
    "ua": "Підготовка за акаунтом Lichess",
    "ru": "Подготовка по аккаунту Lichess"
  },
  "Vorbereitung": {
    "de": "Vorbereitung",
    "en": "Preparation",
    "az": "Hazırlıq",
    "tr": "Hazırlık",
    "ua": "Підготовка",
    "ru": "Подготовка"
  },
  "Lichess-Konto:": {
    "de": "Lichess-Konto:",
    "en": "Lichess account:",
    "az": "Lichess hesabı:",
    "tr": "Lichess hesabı:",
    "ua": "Акаунт Lichess:",
    "ru": "Аккаунт Lichess:"
  },
  "Dieser Spieler hat zu viele Partien für die aktuelle Stellungssuche (höchstens 10.000). Es wird kein gekürztes Ergebnis angezeigt.": {
    "de": "Dieser Spieler hat zu viele Partien für die aktuelle Stellungssuche (höchstens 10.000). Es wird kein gekürztes Ergebnis angezeigt.",
    "en": "Too many games for position search (maximum 10,000). No incomplete results are shown.",
    "az": "Mövqe axtarışı üçün partiya çoxdur (maksimum 10 000). Natamam nəticə göstərilmir.",
    "tr": "Konum araması için çok fazla oyun var (en fazla 10.000). Eksik sonuç gösterilmez.",
    "ua": "Забагато партій для пошуку позиції (максимум 10 000). Неповний результат не показується.",
    "ru": "Слишком много партий для поиска позиции (максимум 10 000). Неполный результат не показывается."
  },
  "Zu viele Anfragen. Bitte warte eine Minute.": {
    "de": "Zu viele Anfragen. Bitte warte eine Minute.",
    "en": "Too many requests. Please wait one minute.",
    "az": "Çox sorğu var. Bir dəqiqə gözləyin.",
    "tr": "Çok fazla istek. Bir dakika bekleyin.",
    "ua": "Забагато запитів. Зачекайте хвилину.",
    "ru": "Слишком много запросов. Подождите минуту."
  },
  "Keine Daten verfügbar. Bitte den vollständigen Namen als Nachname, Vorname oder eine FIDE-ID angeben.": {
    "de": "Keine Daten verfügbar. Bitte den vollständigen Namen als Nachname, Vorname oder eine FIDE-ID angeben.",
    "en": "No data found. Enter the full name as last, first or a FIDE ID.",
    "az": "Məlumat tapılmadı. Tam adı Soyad, Ad və ya FIDE ID kimi daxil edin.",
    "tr": "Veri bulunamadı. Tam adı Soyadı, Adı veya FIDE ID olarak girin.",
    "ua": "Даних немає. Вкажіть прізвище, ім’я або FIDE ID.",
    "ru": "Данных нет. Укажите фамилию, имя или FIDE ID."
  },
  "Stellungssuche derzeit nicht verfügbar.": {
    "de": "Stellungssuche derzeit nicht verfügbar.",
    "en": "Position search is currently unavailable.",
    "az": "Mövqe axtarışı hazırda əlçatan deyil.",
    "tr": "Konum araması şu anda kullanılamıyor.",
    "ua": "Пошук позиції зараз недоступний.",
    "ru": "Поиск позиции сейчас недоступен."
  },
  "Diese Partie kann nicht geöffnet werden.": {
    "de": "Diese Partie kann nicht geöffnet werden.",
    "en": "This game cannot be opened.",
    "az": "Bu partiya açıla bilmir.",
    "tr": "Bu oyun açılamıyor.",
    "ua": "Не вдалося відкрити партію.",
    "ru": "Не удалось открыть партию."
  }
};

export function useRegionalCopy() {
  const language = useOptionalLanguage()?.language || 'de';
  return (label: string): string => regionalCopy[label]?.[language] || translateSectionCopy(label,language);
}
