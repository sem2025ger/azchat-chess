import { translateSectionCopy } from './sectionCopy';
import { useOptionalLanguage } from '../context/LanguageContext';

// Only fixed UI labels are localized; player names, club names, chat text, PGN and FIDE data are never translated.
const regionalCopy: Record<string, Record<string, string>> = {
  "Zurück": {"de": "Zurück", "en": "Back", "az": "Geri", "tr": "Geri", "ua": "Назад", "ru": "Назад"},
  "Vorwärts": {"de": "Vorwärts", "en": "Forward", "az": "İrəli", "tr": "İleri", "ua": "Вперед", "ru": "Вперёд"},
  "Brett drehen": {"de": "Brett drehen", "en": "Flip board", "az": "Taxtanı çevir", "tr": "Tahtayı çevir", "ua": "Перевернути дошку", "ru": "Перевернуть доску"},
  "Eingabe: Züge auf dem Brett": {"de": "Eingabe: Züge auf dem Brett", "en": "Input: board moves", "az": "Daxiletmə: taxtadakı gedişlər", "tr": "Giriş: tahtadaki hamleler", "ua": "Введення: ходи на дошці", "ru": "Ввод: ходы на доске"},
  "Eingabe: Textzüge ab Grundstellung": {"de": "Eingabe: Textzüge ab Grundstellung", "en": "Input: typed moves from the starting position", "az": "Daxiletmə: başlanğıc mövqedən yazılmış gedişlər", "tr": "Giriş: başlangıç konumundan yazılan hamleler", "ua": "Введення: текстові ходи з початкової позиції", "ru": "Ввод: текстовые ходы из начальной позиции"},
  "Gib Züge ein oder spiele auf dem Brett weiter.": {"de": "Gib Züge ein oder spiele auf dem Brett weiter.", "en": "Enter moves or continue playing on the board.", "az": "Gedişləri yazın və ya taxtada davam edin.", "tr": "Hamleleri yazın veya tahtada oynamaya devam edin.", "ua": "Введіть ходи або продовжуйте грати на дошці.", "ru": "Введите ходы или продолжайте играть на доске."},
  "Spielerbereiche": {"de": "Spielerbereiche", "en": "Player sections", "az": "Oyunçu bölmələri", "tr": "Oyuncu bölümleri", "ua": "Розділи гравців", "ru": "Разделы игроков"},
  "Stellungssuche": {"de": "Stellungssuche", "en": "Position search", "az": "Mövqe axtarışı", "tr": "Konum arama", "ua": "Пошук позиції", "ru": "Поиск позиции"},
  "Gegnervorbereitung": {"de": "Gegnervorbereitung", "en": "Opponent preparation", "az": "Rəqibə hazırlıq", "tr": "Rakibe hazırlık", "ua": "Підготовка до суперника", "ru": "Подготовка к сопернику"},
  "Suchbereich": {"de": "Suchbereich", "en": "Search scope", "az": "Axtarış sahəsi", "tr": "Arama kapsamı", "ua": "Область пошуку", "ru": "Область поиска"},
  "Gesamte Datenbank": {"de": "Gesamte Datenbank", "en": "Whole database", "az": "Bütün baza", "tr": "Tüm veritabanı", "ua": "Уся база", "ru": "Вся база"},
  "Nur NRW-Vereine": {"de": "Nur NRW-Vereine", "en": "NRW clubs only", "az": "Yalnız NRW klubları", "tr": "Yalnız NRW kulüpleri", "ua": "Лише клуби NRW", "ru": "Только клубы NRW"},
  "NRW = Spieler, die ihr Profil und ihren NRW-Verein auf ChessAZ bestätigt haben.": {"de": "NRW = Spieler, die ihr Profil und ihren NRW-Verein auf ChessAZ bestätigt haben.", "en": "NRW = players who confirmed their profile and NRW club on ChessAZ.", "az": "NRW = ChessAZ-da profilini və NRW klubunu təsdiqləmiş oyunçular.", "tr": "NRW = ChessAZ üzerinde profilini ve NRW kulübünü doğrulamış oyuncular.", "ua": "NRW = гравці, які підтвердили профіль і клуб NRW на ChessAZ.", "ru": "NRW = игроки, подтвердившие свой профиль и клуб NRW на ChessAZ."},
  "Bestätigte NRW-Spieler:": {"de": "Bestätigte NRW-Spieler:", "en": "Confirmed NRW players:", "az": "Təsdiqlənmiş NRW oyunçuları:", "tr": "Doğrulanmış NRW oyuncuları:", "ua": "Підтверджені гравці NRW:", "ru": "Подтверждённые игроки NRW:"},
  "Noch keine bestätigten NRW-Vereinsspieler.": {"de": "Noch keine bestätigten NRW-Vereinsspieler.", "en": "No confirmed NRW club players yet.", "az": "Hələ təsdiqlənmiş NRW klub oyunçusu yoxdur.", "tr": "Henüz doğrulanmış NRW kulüp oyuncusu yok.", "ua": "Підтверджених гравців клубів NRW поки немає.", "ru": "Подтверждённых игроков клубов NRW пока нет."},
  "Sortierung": {"de": "Sortierung", "en": "Sort order", "az": "Sıralama", "tr": "Sıralama", "ua": "Сортування", "ru": "Сортировка"},
  "Neueste zuerst": {"de": "Neueste zuerst", "en": "Newest first", "az": "Ən yenilər əvvəl", "tr": "En yeniler önce", "ua": "Найновіші спочатку", "ru": "Сначала новые"},
  "Stärkste zuerst": {"de": "Stärkste zuerst", "en": "Strongest first", "az": "Ən güclülər əvvəl", "tr": "En güçlüler önce", "ua": "Найсильніші спочатку", "ru": "Сначала сильнейшие"},
  "Angezeigt:": {"de": "Angezeigt:", "en": "Shown:", "az": "Göstərilir:", "tr": "Gösterilen:", "ua": "Показано:", "ru": "Показано:"},
  "Keine Partien von NRW-Vereinsspielern in dieser Stellung.": {"de": "Keine Partien von NRW-Vereinsspielern in dieser Stellung.", "en": "No games of NRW club players in this position.", "az": "Bu mövqedə NRW klub oyunçularının partiyası yoxdur.", "tr": "Bu konumda NRW kulüp oyuncularının oyunu yok.", "ua": "У цій позиції немає партій гравців клубів NRW.", "ru": "В этой позиции нет партий игроков клубов NRW."},
  "Gesamte Datenbank anzeigen": {"de": "Gesamte Datenbank anzeigen", "en": "Show whole database", "az": "Bütün bazanı göstər", "tr": "Tüm veritabanını göster", "ua": "Показати всю базу", "ru": "Показать всю базу"},
  "Partien anderer Spieler · gesamte Datenbank": {"de": "Partien anderer Spieler · gesamte Datenbank", "en": "Other players’ games · whole database", "az": "Digər oyunçuların partiyaları · bütün baza", "tr": "Diğer oyuncuların oyunları · tüm veritabanı", "ua": "Партії інших гравців · уся база", "ru": "Партии других игроков · вся база"},
  "Spielerstatistik": {"de": "Spielerstatistik", "en": "Player statistics", "az": "Oyunçu statistikası", "tr": "Oyuncu istatistikleri", "ua": "Статистика гравця", "ru": "Статистика игрока"},
  "Indexierte Partien:": {"de": "Indexierte Partien:", "en": "Indexed games:", "az": "İndekslənmiş partiyalar:", "tr": "İndekslenmiş oyunlar:", "ua": "Індексовані партії:", "ru": "Проиндексированные партии:"},
  "Erster Zug mit Weiß": {"de": "Erster Zug mit Weiß", "en": "First move as White", "az": "Ağlarla ilk gediş", "tr": "Beyazla ilk hamle", "ua": "Перший хід білими", "ru": "Первый ход белыми"},
  "Antwort auf 1.e4 mit Schwarz": {"de": "Antwort auf 1.e4 mit Schwarz", "en": "Reply to 1.e4 as Black", "az": "Qaralarla 1.e4-ə cavab", "tr": "Siyahla 1.e4 yanıtı", "ua": "Відповідь на 1.e4 чорними", "ru": "Ответ на 1.e4 чёрными"},
  "Antwort auf 1.d4 mit Schwarz": {"de": "Antwort auf 1.d4 mit Schwarz", "en": "Reply to 1.d4 as Black", "az": "Qaralarla 1.d4-ə cavab", "tr": "Siyahla 1.d4 yanıtı", "ua": "Відповідь на 1.d4 чорними", "ru": "Ответ на 1.d4 чёрными"},
  "Keine Partien dieses Spielers erreichten diese Stellung. Hier sind aktuelle Partien anderer Spieler in derselben Stellung.": {"de": "Keine Partien dieses Spielers erreichten diese Stellung. Hier sind aktuelle Partien anderer Spieler in derselben Stellung.", "en": "No games of this player reached this position. Here are recent games of other players in the same position.", "az": "Bu oyunçunun heç bir partiyası bu mövqeyə çatmayıb. Eyni mövqedə digər oyunçuların son partiyaları buradadır.", "tr": "Bu oyuncunun hiçbir oyunu bu konuma ulaşmadı. Aynı konumdaki diğer oyuncuların son oyunları burada.", "ua": "Жодна партія цього гравця не досягла цієї позиції. Ось останні партії інших гравців у цій самій позиції.", "ru": "Ни одна партия этого игрока не достигла этой позиции. Здесь представлены недавние партии других игроков в той же позиции."},
  "Keine Partien dieses Spielers in unserer Datenbank. Hier sind aktuelle Partien anderer Spieler in derselben Stellung.": {"de": "Keine Partien dieses Spielers in unserer Datenbank. Hier sind aktuelle Partien anderer Spieler in derselben Stellung.", "en": "No games of this player in our database. Here are recent games of other players in the same position.", "az": "Bazamızda bu oyunçunun partiyası yoxdur. Eyni mövqedə digər oyunçuların son partiyaları buradadır.", "tr": "Veritabanımızda bu oyuncunun oyunu yok. Aynı konumdaki diğer oyuncuların son oyunları burada.", "ua": "У нашій базі немає партій цього гравця. Ось останні партії інших гравців у цій самій позиції.", "ru": "В нашей базе нет партий этого игрока. Здесь представлены недавние партии других игроков в той же позиции."},
  "Suchergebnisse": {"de":"Suchergebnisse","en":"Search results","az":"Axtarış nəticələri","tr":"Arama sonuçları","ua":"Результати пошуку","ru":"Результаты поиска"},
  "Stellung in allen importierten Partien suchen": {"de": "Stellung in allen importierten Partien suchen", "en": "Search all imported games by position", "az": "Bütün idxal edilmiş partiyalarda mövqe axtar", "tr": "Tüm içe aktarılan oyunlarda konum ara", "ua": "Пошук позиції в усіх імпортованих партіях", "ru": "Поиск позиции во всех импортированных партиях"},
  "Die ersten 60 Halbzüge jeder importierten Partie. Neueste Partien zuerst.": {"de": "Die ersten 60 Halbzüge jeder importierten Partie. Neueste Partien zuerst.", "en": "The first 60 plies of each imported game. Newest games first.", "az": "Hər idxal edilmiş partiyanın ilk 60 yarımgedişi. Ən yeni partiyalar əvvəl.", "tr": "Her içe aktarılan oyunun ilk 60 yarım hamlesi. En yeni oyunlar önce.", "ua": "Перші 60 півходів кожної імпортованої партії. Найновіші спочатку.", "ru": "Первые 60 полуходов каждой импортированной партии. Сначала новые партии."},
  "Meine Farbe": {"de": "Meine Farbe", "en": "My side", "az": "Mənim rəngim", "tr": "Benim rengim", "ua": "Мій колір", "ru": "Мой цвет"},
  "Stellung in der Datenbank suchen": {"de": "Stellung in der Datenbank suchen", "en": "Search database for position", "az": "Bazadan mövqeni axtar", "tr": "Veritabanında konum ara", "ua": "Шукати позицію в базі", "ru": "Найти позицию в базе"},
  "Spielerfilter (optional)": {"de": "Spielerfilter (optional)", "en": "Player filter (optional)", "az": "Oyunçu filtri (istəyə bağlı)", "tr": "Oyuncu filtresi (isteğe bağlı)", "ua": "Фільтр гравця (необов’язково)", "ru": "Фильтр игрока (необязательно)"},
  "Ohne Spielerfilter gilt die gewählte Farbe für die Ergebniswertung. Bei beiden Farben zählt die Seite am Zug; mit Spielerfilter die Farbe des Spielers.": {"de": "Ohne Spielerfilter gilt die gewählte Farbe für die Ergebniswertung. Bei beiden Farben zählt die Seite am Zug; mit Spielerfilter die Farbe des Spielers.", "en": "Without a player filter, results use the selected side. With both sides, results use the side to move; with a player filter, the player’s side.", "az": "Oyunçu filtri olmadan nəticə seçilən rəngə görə hesablanır. Hər iki rəng üçün gediş növbəsi olan tərəf, oyunçu filtri ilə isə oyunçunun rəngi əsas götürülür.", "tr": "Oyuncu filtresi olmadan sonuçlar seçilen renge göredir. İki renkte hamle sırası olan taraf; oyuncu filtresiyle oyuncunun rengi kullanılır.", "ua": "Без фільтра гравця результати подано для вибраного кольору. Для обох кольорів — для сторони, чий хід; із фільтром — для кольору гравця.", "ru": "Без фильтра игрока результаты считаются для выбранного цвета. Для обоих цветов — со стороны, чья очередь хода; с фильтром — со стороны игрока."},
  "Stellung wird gesucht …": {"de": "Stellung wird gesucht …", "en": "Searching for position…", "az": "Mövqe axtarılır…", "tr": "Konum aranıyor…", "ua": "Пошук позиції…", "ru": "Поиск позиции…"},
  "Die Suche wird vorbereitet. Bitte versuche es in wenigen Sekunden erneut.": {"de": "Die Suche wird vorbereitet. Bitte versuche es in wenigen Sekunden erneut.", "en": "Search is preparing. Please try again in a few seconds.", "az": "Axtarış hazırlanır. Bir neçə saniyədən sonra yenidən cəhd edin.", "tr": "Arama hazırlanıyor. Birkaç saniye sonra tekrar deneyin.", "ua": "Пошук готується. Спробуйте знову за кілька секунд.", "ru": "Поиск подготавливается. Повторите попытку через несколько секунд."},
  "Spielersuche derzeit nicht verfügbar.": {"de": "Spielersuche derzeit nicht verfügbar.", "en": "Player search is currently unavailable.", "az": "Oyunçu axtarışı hazırda əlçatan deyil.", "tr": "Oyuncu araması şu anda kullanılamıyor.", "ua": "Пошук гравців наразі недоступний.", "ru": "Поиск игроков сейчас недоступен."},
  "Neueste Partien zuerst. Angezeigt:": {"de": "Neueste Partien zuerst. Angezeigt:", "en": "Newest games first. Showing:", "az": "Ən yeni partiyalar əvvəl. Göstərilir:", "tr": "En yeni oyunlar önce. Gösterilen:", "ua": "Найновіші партії спочатку. Показано:", "ru": "Сначала новые партии. Показано:"},
  "Keine Partien erreichten diese Stellung.": {"de": "Keine Partien erreichten diese Stellung.", "en": "No games reached this position.", "az": "Heç bir partiya bu mövqeyə çatmayıb.", "tr": "Hiçbir oyun bu konuma ulaşmadı.", "ua": "Жодна партія не досягла цієї позиції.", "ru": "Нет партий, достигших этой позиции."},
  "Nächste Züge · Ergebnisse aus deiner Sicht": {"de": "Nächste Züge · Ergebnisse aus deiner Sicht", "en": "Next moves · results from your side", "az": "Növbəti gedişlər · sizin tərəfdən nəticələr", "tr": "Sonraki hamleler · sizin açınızdan sonuçlar", "ua": "Наступні ходи · результати з вашого боку", "ru": "Следующие ходы · результаты с вашей стороны"},
  "Sieg": {"de": "Sieg", "en": "Win", "az": "Qələbə", "tr": "Galibiyet", "ua": "Перемога", "ru": "Победа"},
  "Niederlage": {"de": "Niederlage", "en": "Loss", "az": "Məğlubiyyət", "tr": "Mağlubiyet", "ua": "Поразка", "ru": "Поражение"},
  "Ergebnis offen": {"de": "Ergebnis offen", "en": "Result unknown", "az": "Nəticə məlum deyil", "tr": "Sonuç bilinmiyor", "ua": "Результат невідомий", "ru": "Результат неизвестен"},
  "Nach Zügen oder Stellung suchen": {"de": "Nach Zügen oder Stellung suchen", "en": "Search by moves or position", "az": "Gedişlər və ya mövqe ilə axtar", "tr": "Hamlelere veya konuma göre ara", "ua": "Пошук за ходами або позицією", "ru": "Поиск по ходам или позиции"},
  "Züge spielen": {"de": "Züge spielen", "en": "Play moves", "az": "Gedişləri oyna", "tr": "Hamleleri oyna", "ua": "Робити ходи", "ru": "Играть ходы"},
  "Stellung aufstellen": {"de": "Stellung aufstellen", "en": "Set up position", "az": "Mövqe qur", "tr": "Konum kur", "ua": "Розставити позицію", "ru": "Расставить позицию"},
  "Grundstellung": {"de": "Grundstellung", "en": "Starting position", "az": "Başlanğıc mövqe", "tr": "Başlangıç konumu", "ua": "Початкова позиція", "ru": "Начальная позиция"},
  "Umwandlung": {"de": "Umwandlung", "en": "Promotion", "az": "Çevrilmə", "tr": "Terfi", "ua": "Перетворення", "ru": "Превращение"},
  "Dame": {"de": "Dame", "en": "Queen", "az": "Vəzir", "tr": "Vezir", "ua": "Ферзь", "ru": "Ферзь"},
  "Turm": {"de": "Turm", "en": "Rook", "az": "Top", "tr": "Kale", "ua": "Тура", "ru": "Ладья"},
  "Läufer": {"de": "Läufer", "en": "Bishop", "az": "Fil", "tr": "Fil", "ua": "Слон", "ru": "Слон"},
  "Springer": {"de": "Springer", "en": "Knight", "az": "At", "tr": "At", "ua": "Кінь", "ru": "Конь"},
  "Züge (SAN oder deutsche Figurenbuchstaben)": {"de": "Züge (SAN oder deutsche Figurenbuchstaben)", "en": "Moves (SAN or German piece letters)", "az": "Gedişlər (SAN və ya almanca fiqur hərfləri)", "tr": "Hamleler (SAN veya Almanca taş harfleri)", "ua": "Ходи (SAN або німецькі літери фігур)", "ru": "Ходы (SAN или немецкие обозначения фигур)"},
  "Züge suchen": {"de": "Züge suchen", "en": "Search moves", "az": "Gedişləri axtar", "tr": "Hamleleri ara", "ua": "Шукати ходи", "ru": "Найти по ходам"},
  "Ungültige Zugfolge": {"de": "Ungültige Zugfolge", "en": "Invalid move sequence", "az": "Yanlış gediş ardıcıllığı", "tr": "Geçersiz hamle dizisi", "ua": "Некоректна послідовність ходів", "ru": "Некорректная последовательность ходов"},
  "Dieser Zug ist nicht möglich.": {"de": "Dieser Zug ist nicht möglich.", "en": "This move is not legal.", "az": "Bu gediş mümkün deyil.", "tr": "Bu hamle geçerli değil.", "ua": "Цей хід неможливий.", "ru": "Этот ход невозможен."},
  "Vorbereitungsbrett": {"de": "Vorbereitungsbrett", "en": "Preparation board", "az": "Hazırlıq lövhəsi", "tr": "Hazırlık tahtası", "ua": "Дошка підготовки", "ru": "Доска подготовки"},
  "Figurenpalette": {"de": "Figurenpalette", "en": "Piece palette", "az": "Fiqur palitrası", "tr": "Taş paleti", "ua": "Палітра фігур", "ru": "Палитра фигур"},
  "Entfernen": {"de": "Entfernen", "en": "Remove", "az": "Sil", "tr": "Kaldır", "ua": "Видалити", "ru": "Удалить"},
  "Brett leeren": {"de": "Brett leeren", "en": "Clear board", "az": "Lövhəni təmizlə", "tr": "Tahtayı temizle", "ua": "Очистити дошку", "ru": "Очистить доску"},
  "Am Zug": {"de": "Am Zug", "en": "Side to move", "az": "Gediş növbəsi", "tr": "Hamle sırası", "ua": "Черга ходу", "ru": "Очередь хода"},
  "Rochaderechte": {"de": "Rochaderechte", "en": "Castling rights", "az": "Rok hüquqları", "tr": "Rok hakları", "ua": "Права на рокіровку", "ru": "Права на рокировку"},
  "Stellung suchen": {"de": "Stellung suchen", "en": "Search position", "az": "Mövqeni axtar", "tr": "Konumu ara", "ua": "Шукати позицію", "ru": "Найти позицию"},
  "leer": {"de": "leer", "en": "empty", "az": "boş", "tr": "boş", "ua": "порожньо", "ru": "пусто"},
  "Bitte zuerst anmelden": {"de": "Bitte zuerst anmelden", "en": "Sign in first", "az": "Əvvəlcə daxil olun", "tr": "Önce giriş yapın", "ua": "Спочатку увійдіть", "ru": "Сначала войдите"},
  "Nachname": {"de": "Nachname", "en": "Last name", "az": "Soyad", "tr": "Soyadı", "ua": "Прізвище", "ru": "Фамилия"},
  "Spieltag": {"de": "Spieltag", "en": "Matchday", "az": "Oyun günü", "tr": "Maç günü", "ua": "Ігровий день", "ru": "Игровой день"},
  "Najdorf oder B90": {"de": "Najdorf oder B90", "en": "Najdorf or B90", "az": "Najdorf və ya B90", "tr": "Najdorf veya B90", "ua": "Найдорф або B90", "ru": "Найдорф или B90"},
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
