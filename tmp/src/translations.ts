export type Language = 'en' | 'de' | 'az' | 'tr' | 'ua' | 'ru';

type TranslationDictionary = Record<string, Record<Language, string>>;

export const translations: TranslationDictionary = {
  // Navigation & Layout
  'nav.home': { en: 'Home', de: 'Startseite', ua: 'Головна', ru: 'Главная', az: 'Ana Səhifə', tr: 'Ana Sayfa' },
  'nav.play': { en: 'Play', de: 'Spielen', ua: 'Грати', ru: 'Играть', az: 'Oyna', tr: 'Oyna' },
  'nav.game': { en: 'Game', de: 'Spiel', ua: 'Гра', ru: 'Игра', az: 'Oyun', tr: 'Oyun' },
  'nav.chat': { en: 'Chat', de: 'Chat', ua: 'Чат', ru: 'Чат', az: 'Söhbət', tr: 'Sohbet' },
  'nav.profile': { en: 'Profile', de: 'Profil', ua: 'Профіль', ru: 'Профиль', az: 'Profil', tr: 'Profil' },
  'nav.settings': { en: 'Settings', de: 'Einstellungen', ua: 'Налаштування', ru: 'Настройки', az: 'Ayarlar', tr: 'Ayarlar' },

  // Home Screen
  'home.title': { en: 'AZTR Chess Platform', de: 'AZTR Schachplattform', ua: 'Шахова платформа AZTR', ru: 'Шахматная Платформа AZTR', az: 'AZTR Şahmat Platforması', tr: 'AZTR Satranç Platformu' },
  'home.subtitle': {
    en: 'Premium chess platform for Azerbaijan, Turkey and Russia. Connect, compete and customize your experience.',
    de: 'Premium-Schachplattform für Aserbaidschan, die Türkei und Russland. Verbinden, antreten und anpassen.',
    ua: 'Преміальна шахова платформа для Азербайджану, Туреччини та Росії. Спілкуйтеся, змагайтеся та налаштовуйте свій досвід.',
    ru: 'Премиальная шахматная платформа для Азербайджана, Турции и России. Общайтесь, соревнуйтесь и настраивайте свой опыт.',
    az: 'Azərbaycan, Türkiyə və Rusiya üçün premium onlayn şahmat ünvanı. Bağlan, yarış və təcrübəni fərdiləşdir.',
    tr: 'Azerbaycan, Türkiye ve Rusya için premium çevrimiçi satranç adresi. Bağlan, rekabet et ve deneyimini özelleştir.'
  },
  'home.playNow': { en: 'Play Now', de: 'Jetzt spielen', ua: 'Грати зараз', ru: 'Играть сейчас', az: 'İndi Oyna', tr: 'Şimdi Oyna' },
  'home.cards.play.title': { en: 'Play Match', de: 'Match spielen', ua: 'Почати матч', ru: 'Начать матч', az: 'Matç Oyna', tr: 'Maç Oyna' },
  'home.cards.play.desc': { en: 'Find an opponent in Bullet, Blitz or Rapid.', de: 'Gegner finden in Bullet, Blitz oder Rapid.', ua: 'Знайдіть супротивника у Bullet, Blitz або Rapid.', ru: 'Найдите противника в Bullet, Blitz или Rapid.', az: 'Bullet, Blitz və ya Rapid rejimində rəqib tap.', tr: 'Bullet, Blitz veya Rapid modunda rakip bul.' },
  'home.cards.game.title': { en: 'Active Game', de: 'Aktives Spiel', ua: 'Активна гра', ru: 'Активная игра', az: 'Aktiv Oyun', tr: 'Aktif Oyun' },
  'home.cards.game.desc': { en: 'Return to your current matches or analysis.', de: 'Zurück zu deinen aktuellen Matches oder zur Analyse.', ua: 'Поверніться до своїх поточних матчів або аналізу.', ru: 'Вернитесь к своим текущим матчам или анализу.', az: 'Cari matçlarına və ya analizə qayıt.', tr: 'Mevcut maçlarına veya analize dön.' },
  'home.cards.profile.title': { en: 'Player Profile', de: 'Spielerprofil', ua: 'Профіль гравця', ru: 'Профиль игрока', az: 'Oyunçu Profili', tr: 'Oyuncu Profili' },
  'home.cards.profile.desc': { en: 'Manage your profile and player settings.', de: 'Verwalte dein Profil und deine Spielereinstellungen.', ua: 'Керуйте своїм профілем та налаштуваннями гравця.', ru: 'Управляйте своим профилем и настройками игрока.', az: 'Profilinizi və oyunçu parametrlərinizi idarə edin.', tr: 'Profilini ve oyuncu ayarlarını yönet.' },
  'home.cards.chat.title': { en: 'Community', de: 'Community', ua: 'Спільнота', ru: 'Сообщество', az: 'İcma', tr: 'Topluluk' },
  'home.cards.chat.desc': { en: 'Join global chat and make friends.', de: 'Trete dem globalen Chat bei und finde Freunde.', ua: 'Приєднуйтесь до глобального чату та заводьте друзів.', ru: 'Присоединяйтесь к глобальному чату и заводите друзей.', az: 'Qlobal söhbətə qoşul və dostlar tap.', tr: 'Küresel sohbete katıl ve arkadaşlar edin.' },

  // Play Screen
  'play.tabs.play': { en: 'Play', de: 'Spielen', ua: 'Грати', ru: 'Играть', az: 'Oyna', tr: 'Oyna' },
  'play.tabs.tournaments': { en: 'Tournaments', de: 'Turniere', ua: 'Турніри', ru: 'Турниры', az: 'Turnirlər', tr: 'Turnuvalar' },
  'play.tabs.computer': { en: 'Computer', de: 'Computer', ua: 'Комп\'ютер', ru: 'Компьютер', az: 'Kompüter', tr: 'Bilgisayar' },
  'play.timeControl': { en: 'Time Control', de: 'Zeitkontrolle', ua: 'Контроль часу', ru: 'Контроль времени', az: 'Vaxt Nəzarəti', tr: 'Zaman Kontrolü' },
  'play.matchType': { en: 'Match Type', de: 'Spielart', ua: 'Тип матчу', ru: 'Тип матча', az: 'Matç Növü', tr: 'Maç Türü' },
  'play.type.rated': { en: 'Rated', de: 'Gewertet', ua: 'Рейтинговий', ru: 'Рейтинговый', az: 'Reytinqli', tr: 'Dereceli' },
  'play.type.casual': { en: 'Casual', de: 'Zwanglos', ua: 'Товариський', ru: 'Товарищеский', az: 'Dostluq', tr: 'Dostluk' },
  'play.region': { en: 'Region', de: 'Region', ua: 'Регіон', ru: 'Регион', az: 'Region', tr: 'Bölge' },
  'play.region.global': { en: 'Global', de: 'Global', ua: 'Глобальний', ru: 'Глобальный', az: 'Qlobal', tr: 'Küresel' },
  'play.startGame': { en: 'START GAME', de: 'SPIEL STARTEN', ua: 'ПОЧАТИ ГРУ', ru: 'НАЧАТЬ ИГРУ', az: 'OYUNA BAŞLA', tr: 'OYUNA BAŞLA' },
  'play.playersOnline': { en: 'Players Online', de: 'Spieler online', ua: 'Гравців онлайн', ru: 'Игроков онлайн', az: 'Oyunçu Onlayn', tr: 'Oyuncu Çevrimiçi' },
  'play.searching': { en: 'Searching for opponent...', de: 'Gegner wird gesucht...', ua: 'Пошук супротивника...', ru: 'Поиск противника...', az: 'Rəqib axtarılır...', tr: 'Rakip aranıyor...' },
  'play.searchingDesc': { en: 'Expected wait: < 10s', de: 'Erwartete Wartezeit: < 10s', ua: 'Очікування: < 10сек', ru: 'Ожидание: < 10сек', az: 'Gözlənilən vaxt: < 10s', tr: 'Tahmini bekleme: < 10s' },
  'play.cancel': { en: 'Cancel', de: 'Abbrechen', ua: 'Скасувати', ru: 'Отмена', az: 'Ləğv et', tr: 'İptal' },
  'play.friend': { en: 'Play with Friend', de: 'Mit Freund spielen', ua: 'Грати з другом', ru: 'Играть с другом', az: 'Dostla Oyna', tr: 'Arkadaşla Oyna' },
  'play.tournaments': { en: 'Join Tournament', de: 'Turnier beitreten', ua: 'Приєднатися до турніру', ru: 'Присоединиться к турниру', az: 'Turnirə Qoşul', tr: 'Turnuvaya Katıl' },

  // Game Screen
  'game.tabs.moves': { en: 'Moves', de: 'Züge', ua: 'Ходи', ru: 'Ходы', az: 'Gedişlər', tr: 'Hamleler' },
  'game.tabs.chat': { en: 'Chat', de: 'Chat', ua: 'Чат', ru: 'Чат', az: 'Söhbət', tr: 'Sohbet' },

  'game.chat.start': { en: 'Match started! Good luck.', de: 'Spiel gestartet! Viel Glück.', ua: 'Матч розпочався! Хай щастить.', ru: 'Матч начался! Удачи.', az: 'Matç başlayır! Uğurlar.', tr: 'Maç başlıyor! Bol şans.' },
  'game.chat.placeholder': { en: 'Type a message...', de: 'Nachricht eingeben...', ua: 'Введіть повідомлення...', ru: 'Введите сообщение...', az: 'Mesaj yaz...', tr: 'Mesaj yaz...' },
  'game.resign': { en: 'Resign', de: 'Aufgeben', ua: 'Здатися', ru: 'Сдаться', az: 'Təslim ol', tr: 'Terk Et' },
  'game.draw': { en: 'Offer Draw', de: 'Remis anbieten', ua: 'Запропонувати нічию', ru: 'Предложить ничью', az: 'Heç-heçə təklif et', tr: 'Beraberlik Teklif Et' },
  'game.white': { en: 'White', de: 'Weiß', ua: 'Білі', ru: 'Белые', az: 'Ağ', tr: 'Beyaz' },
  'game.black': { en: 'Black', de: 'Schwarz', ua: 'Чорні', ru: 'Черные', az: 'Qara', tr: 'Siyah' },

  // Stockfish Analysis UI
  'game.tabs.analysis': { en: 'Analysis', de: 'Analyse', ua: 'Аналіз', ru: 'Анализ', az: 'Analiz', tr: 'Analiz' },
  'game.analysis.engineLoading': { en: 'Loading engine...', de: 'Engine lädt...', ua: 'Завантаження рушія...', ru: 'Загрузка движка...', az: 'Mühərrik Yüklənir...', tr: 'Motor Yükleniyor...' },
  'game.analysis.bestMove': { en: 'Best Move', de: 'Bester Zug', ua: 'Найкращий хід', ru: 'Лучший ход', az: 'Ən Yaxşı Gediş', tr: 'En İyi Hamle' },
  'game.analysis.candidates': { en: 'Candidates', de: 'Kandidaten', ua: 'Кандидати', ru: 'Кандидаты', az: 'Namizəd Gedişlər', tr: 'Aday Hamleler' },
  'game.analysis.depth': { en: 'Depth', de: 'Tiefe', ua: 'Глибина', ru: 'Глубина', az: 'Dərinlik', tr: 'Derinlik' },
  'game.analysis.toggle': { en: 'Toggle Analysis', de: 'Analyse umschalten', ua: 'Увімкнути аналіз', ru: 'Включить анализ', az: 'Analizi Aktivləşdir', tr: 'Analizi Aç/Kapat' },
  'game.analysis.quality.best': { en: 'Best', de: 'Am besten', ua: 'Найкращий', ru: 'Лучший', az: 'Əla', tr: 'En İyi' },
  'game.analysis.quality.good': { en: 'Good', de: 'Gut', ua: 'Добрий', ru: 'Хороший', az: 'Yaxşı', tr: 'İyi' },
  'game.analysis.quality.inaccurate': { en: 'Inaccurate', de: 'Ungenau', ua: 'Неточний', ru: 'Неточный', az: 'Qeyri-dəqiq', tr: 'Hatalı' },
  'game.analysis.quality.mistake': { en: 'Mistake', de: 'Fehler', ua: 'Помилка', ru: 'Ошибка', az: 'Səhv', tr: 'Yanlış' },
  'game.analysis.quality.blunder': { en: 'Blunder', de: 'Patzer', ua: 'Зівок', ru: 'Зевок', az: 'Kobud Səhv', tr: 'Pot' },
  'game.analysis.detail': { en: 'Evaluation details', de: 'Bewertungsdetails', ua: 'Деталі оцінки', ru: 'Детали оценки', az: 'Qiymətləndirmə detalları', tr: 'Değerlendirme detayları' },
  'game.analysis.qualityLabel': { en: 'Quality evaluation', de: 'Qualitätsbewertung', ua: 'Оцінка якості', ru: 'Оценка качества', az: 'Keyfiyyətin qiymətləndirilməsi', tr: 'Kalite değerlendirmesi' },
  'game.analysis.nomoves': { en: 'No moves yet', de: 'Noch keine Züge', ua: 'Ходів ще немає', ru: 'Ходов еще нет', az: 'Hələ gediş yoxdur', tr: 'Henüz hamle yok' },
  'game.analysis.unavailable': { en: 'Analysis unavailable', de: 'Analyse nicht verfügbar', ua: 'Аналіз недоступний', ru: 'Анализ недоступен', az: 'Analiz mümkün deyil', tr: 'Analiz kullanılamıyor' },
  'game.analysis.hint': { en: 'Use engine lines alongside coach tips.', de: 'Verwenden Sie Engine-Linien zusammen mit Trainer-Tipps.', ua: 'Використовуйте лінії рушія разом з порадами тренера.', ru: 'Используйте линии движка вместе с советами тренера.', az: 'Məşqçinin məsləhətləri ilə birlikdə mühərrik xətlərindən istifadə edin.', tr: 'Antrenör tavsiyeleriyle birlikte motor hatlarını kullanın.' },
  'game.analysis.analyzing': { en: 'Analyzing', de: 'Analysiere…', ru: 'Анализ…', ua: 'Аналіз…', az: 'Analiz…', tr: 'Analiz…' },
  'game.analysis.ready': { en: 'Ready', de: 'Bereit', ru: 'Готов', ua: 'Готовий', az: 'Hazır', tr: 'Hazır' },
  'game.analysis.analyzing_position': { en: 'Analyzing position…', de: 'Position wird analysiert…', ru: 'Анализ позиции…', ua: 'Аналіз позиції…', az: 'Mövqe analiz edilir…', tr: 'Pozisyon analiz ediliyor…' },

  // AI Chat Assistant UI
  'chat.assistant.title': { en: 'AI Chat Assistant', de: 'KI-Chat-Assistent', ua: 'Чат-помічник ШІ', ru: 'Чат-помощник ИИ', az: 'Söhbət Köməkçisi', tr: 'Sohbet Yardımcısı' },
  'chat.assistant.translate': { en: 'Translate', de: 'Übersetzen', ua: 'Перекласти', ru: 'Перевести', az: 'Tərcümə Et', tr: 'Çevir' },
  'chat.assistant.translateBubble': { en: 'Translate to my language', de: 'In meine Sprache übersetzen', ua: 'Перекласти моєю мовою', ru: 'Перевести на мой язык', az: 'Dilimə tərcümə et', tr: 'Dilime çevir' },
  'chat.assistant.polite': { en: 'Make Polite', de: 'Höflich machen', ua: 'Ввічливо', ru: 'Вежливо', az: 'Nəzakətli Et', tr: 'Nazik Yap' },
  'chat.assistant.friendly': { en: 'Make Friendly', de: 'Freundlich machen', ua: 'Дружньо', ru: 'Дружелюбно', az: 'Səmimi Et', tr: 'Samimi Yap' },
  'chat.assistant.neutral': { en: 'Make Neutral', de: 'Neutral machen', ua: 'Нейтрально', ru: 'Нейтрально', az: 'Neytral Et', tr: 'Nötr Yap' },
  'chat.assistant.toxicityWarning': { en: 'Warning: sounds aggressive.', de: 'Warnung: klingt aggressiv.', ua: 'Попередження: це звучить агресивно.', ru: 'Предупреждение: это звучит агрессивно. Попробуйте спокойнее?', az: 'Təhlükəsizlik Xəbərdarlığı: Bu bir az aqressiv görünür. Daha sakit versiyanı sınayın?', tr: 'Güvenlik Uyarısı: Bu biraz agresif görünüyor. Daha sakin bir sürüm dener misiniz?' },
  'chat.assistant.phrases': { en: 'Quick phrases', de: 'Schnelle Phrasen', ua: 'Швидкі фрази', ru: 'Быстрые фразы', az: 'Tez Chess İfadələri', tr: 'Hızlı Satranç İfadeleri' },
  'chat.assistant.terms': { en: 'Terms', de: 'Begriffe', ua: 'Терміни', ru: 'Термины', az: 'Şahmat Termini İzahları', tr: 'Satranç Terimi Açıklamaları' },
  'chat.assistant.suggestions': { en: 'Quick replies', de: 'Schnelle Antworten', ua: 'Швидкі відповіді', ru: 'Быстрые ответы', az: 'Sürətli Cavablar', tr: 'Hızlı Cevaplar' },
  'chat.assistant.preview': { en: 'AI Preview', de: 'KI-Vorschau', ua: 'Перегляд ШІ', ru: 'Предпросмотр ИИ', az: 'Süni İntellekt Təklifi', tr: 'Yapay Zeka Önerisi' },
  'chat.assistant.insert': { en: 'Insert', de: 'Einfügen', ua: 'Вставити', ru: 'Вставить', az: 'Mətnə Əlavə Et', tr: 'Metne Ekle' },
  'chat.assistant.close': { en: 'Close assistant', de: 'Assistent schließen', ua: 'Закрити помічника', ru: 'Закрыть помощника', az: 'Köməkçini Bağla', tr: 'Yardımcıyı Kapat' },

  // Chat Screen
  'chat.globalTitle': { en: 'Global chat', de: 'Globaler Chat', ua: 'Глобальний чат', ru: 'Глобальный чат', az: 'Qlobal Region Söhbəti', tr: 'Küresel Bölge Sohbeti' },
  'chat.subtitle': { en: 'Azerbaijan • Turkey • Russia', de: 'Aserbaidschan • Türkei • Russland', ua: 'Азербайджан • Туреччина • Росія', ru: 'Азербайджан • Турция • Россия', az: 'Azərbaycan • Türkiyə • Rusiya', tr: 'Azerbaycan • Türkiye • Rusya' },
  'chat.onlineUsers': { en: 'Online Users', de: 'Online-Benutzer', ua: 'Користувачі онлайн', ru: 'Пользователи онлайн', az: 'Onlayn İstifadəçilər', tr: 'Çevrimiçi Kullanıcılar' },
  'chat.sendPlaceholder': { en: 'Send message to global chat...', de: 'Nachricht an den globalen Chat senden...', ua: 'Відправити повідомлення в глобальний чат...', ru: 'Отправить сообщение в глобальный чат...', az: 'Qlobal söhbətə mesaj göndər...', tr: 'Küresel sohbete mesaj gönder...' },

  // Profile Screen
  'profile.memberSince': { en: 'Member Since', de: 'Mitglied seit', ua: 'У спільноті з', ru: 'В сообществе с', az: 'Üzvlük tarixi', tr: 'Üyelik tarihi' },
  'profile.performance': { en: 'Performance', de: 'Leistung', ua: 'Результативність', ru: 'Результативность', az: 'Göstəricilər', tr: 'Performans' },
  'profile.wins': { en: 'Wins', de: 'Siege', ua: 'Перемоги', ru: 'Победы', az: 'Qələbə', tr: 'Galibiyet' },
  'profile.draws': { en: 'Draws', de: 'Unentschieden', ua: 'Нічиї', ru: 'Ничьи', az: 'Heç-heçə', tr: 'Beraberlik' },
  'profile.losses': { en: 'Losses', de: 'Niederlagen', ua: 'Поразки', ru: 'Поражения', az: 'Məğlubiyyət', tr: 'Mağlubiyet' },
  'profile.recentTrophies': { en: 'Trophies', de: 'Trophäen', ua: 'Трофеї', ru: 'Трофеи', az: 'Son Nailiyyətlər', tr: 'Son Başarılar' },
  'profile.recentGames': { en: 'Recent Games', de: 'Letzte Spiele', ua: 'Останні ігри', ru: 'Последние игры', az: 'Son Oyunlar', tr: 'Son Oyunlar' },
  'profile.review': { en: 'Review →', de: 'Überprüfen →', ua: 'Огляд →', ru: 'Обзор →', az: 'Baxış →', tr: 'İncele →' },

  // Settings Screen
  'settings.title': { en: 'App Settings', de: 'App-Einstellungen', ua: 'Налаштування додатку', ru: 'Настройки приложения', az: 'Tətbiq Ayarları', tr: 'Uygulama Ayarları' },
  'settings.changeLanguage': { en: 'Change Language', de: 'Sprache ändern', ua: 'Змінити мову', ru: 'Изменить язык', az: 'Dili dəyişdir', tr: 'Dili değiştir' },
  'settings.specialThemes': { en: 'Special Themes', de: 'Spezielle Themen', ua: 'Спеціальні теми', ru: 'Специальные темы', az: 'Xüsusi Mövzuları Aktivləşdir', tr: 'Özel Temaları Etkinleştir' },
  'settings.boardAppearance': { en: 'Board Appearance', de: 'Board-Aussehen', ua: 'Зовнішній вигляд дошки', ru: 'Внешний вид доски', az: 'Lövhə Görünüşü', tr: 'Tahta Görünümü' },
  'settings.pieceStyles': { en: 'Chess Pieces', de: 'Schachfiguren', ua: 'Шахові фігури', ru: 'Шахматные фигуры', az: 'Şahmat Fiqurları', tr: 'Satranç Taşları' },
  'settings.soundThemes': { en: 'Sound Themes', de: 'Sound-Themen', ua: 'Звукові теми', ru: 'Звуковые темы', az: 'Səs Mövzuları', tr: 'Ses Temaları' },

  // Role Separation & Categories
  'game.analysis.dashboard': { en: 'Engine Dashboard', de: 'Engine-Dashboard', ua: 'Панель інструментів рушія', ru: 'Панель инструментов движка', az: 'Mühərrik alətlər paneli', tr: 'Motor araç paneli' },
  'game.analysis.variations': { en: 'Tactical Variations', de: 'Taktische Varianten', ua: 'Тактичні варіанти', ru: 'Тактические варианты', az: 'Taktiki variantlar', tr: 'Taktik varyasyonlar' },
  'game.analysis.engineStatus': { en: 'Engine Status', de: 'Engine-Status', ua: 'Статус рушія', ru: 'Статус движка', az: 'Mühərrik statusu', tr: 'Motor durumu' },
  'game.analysis.engineLabel': { en: 'Tactical Engine / UCI v2.0', de: 'Taktische Engine / UCI v2.0', ua: 'Тактичний рушій / UCI v2.0', ru: 'Тактический движок / UCI v2.0', az: 'Taktiki Mühərrik / UCI v2.0', tr: 'Taktik Motor / UCI v2.0' },
  'game.analysis.processActive': { en: 'Process Active', de: 'Prozess aktiv', ua: 'Процес активний', ru: 'Процесс активен', az: 'Proses Aktiv', tr: 'İşlem Aktif' },
  'game.analysis.engineAwaiting': { en: 'Engine awaiting match data', de: 'Engine erwartet Spieldaten', ua: 'Рушій очікує дані матчу', ru: 'Движок ожидает данные матча', az: 'Mühərrik matç məlumatlarını gözləyir', tr: 'Motor maç verilerini bekliyor' },
  'game.analysis.engineFault': { en: 'Critical Engine Fault', de: 'Kritischer Engine-Fehler', ua: 'Критична помилка рушія', ru: 'Критическая ошибка движка', az: 'Kritik Mühərrik Xətası', tr: 'Kritik Motor Hatası' },
  'game.analysis.multiLine': { en: 'Multi-line analysis', de: 'Mehrlinige Analyse', ua: 'Багатоваріантний аналіз', ru: 'Многовариантный анализ', az: 'Çox xəttli analiz', tr: 'Çoklu hat analizi' },
  'game.analysis.lineLabel': { en: 'Line', de: 'Linie', ua: 'Лінія', ru: 'Линия', az: 'Xətt', tr: 'Hat' },

  // Home screen
  'home.stats.players': { en: 'Players', de: 'Spieler', ua: 'Гравці', ru: 'Игроки', az: 'Oyunçular', tr: 'Oyuncular' },
  'home.stats.activeMatches': { en: 'Active Matches', de: 'Aktive Matches', ua: 'Активні матчі', ru: 'Активные матчи', az: 'Aktiv matçlar', tr: 'Aktif maçlar' },
  'home.stats.countries': { en: 'Countries', de: 'Länder', ua: 'Країни', ru: 'Страны', az: 'Ölkələr', tr: 'Ülkeler' },
  'home.platformDemo': { en: 'Premium Chess Platform', de: 'Premium-Schachplattform', ua: 'Преміальна шахова платформа', ru: 'Премиальная шахматная платформа', az: 'Premium Şahmat Platforması', tr: 'Premium Satranç Platformu' },
  'home.explore': { en: 'Explore', de: 'Erkunden', ua: 'Дослідити', ru: 'Исследовать', az: 'Kəşf et', tr: 'Keşfet' },

  // Chat screen
  'chat.communityHub': { en: 'COMMUNITY HUB', de: 'COMMUNITY-HUB', ua: 'ЦЕНТР СПІЛЬНОТИ', ru: 'СООБЩЕСТВО', az: 'İCMA MƏRKƏZİ', tr: 'TOPLULUK MERKEZİ' },
  'chat.liveCount': { en: 'Live', de: 'Live', ua: 'Наживо', ru: 'В сети', az: 'Canlı', tr: 'Çevrimiçi' },
  'chat.youBadge': { en: 'YOU', de: 'DU', ua: 'ВИ', ru: 'ВЫ', az: 'SİZ', tr: 'SİZ' },
  'chat.worldPlayers': { en: 'World Players', de: 'Weltspieler', ua: 'Гравці світу', ru: 'Мировые игроки', az: 'Dünya Oyunçuları', tr: 'Dünya Oyuncuları' },
  'chat.joinQueue': { en: 'Join Queue', de: 'Warteschlange beitreten', ua: 'Приєднатися до черги', ru: 'Присоединиться', az: 'Növbəyə qoşul', tr: 'Sıraya katıl' },
  'chat.comingSoon': { en: 'Global chat is coming soon', de: 'Der globale Chat kommt bald', ua: 'Глобальний чат незабаром зʼявиться', ru: 'Глобальный чат скоро появится', az: 'Qlobal çat tezliklə istifadəyə veriləcək', tr: 'Global sohbet yakında kullanıma sunulacak' },

  // Profile screen
  'profile.topPercent': { en: 'TOP 1%', de: 'TOP 1%', ua: 'ТОП 1%', ru: 'ТОП 1%', az: 'TOP 1%', tr: 'TOP %1' },
  'profile.globalRank': { en: 'Global Rank', de: 'Globaler Rang', ua: 'Глобальний рейтинг', ru: 'Мировой рейтинг', az: 'Qlobal Sıralama', tr: 'Küresel Sıralama' },
  'profile.winRate': { en: 'Win Rate', de: 'Siegquote', ua: 'Відсоток перемог', ru: 'Процент побед', az: 'Qalibiyyət nisbəti', tr: 'Kazanma oranı' },
  'profile.viewHistory': { en: 'View History', de: 'Verlauf anzeigen', ua: 'Переглянути історію', ru: 'Вся история', az: 'Bütün tarixçə', tr: 'Tüm geçmiş' },
  'profile.unrated': { en: 'Unrated', de: 'Ohne Wertung', ua: 'Без рейтингу', ru: 'Без рейтинга', az: 'Reytinqsiz', tr: 'Reytingsiz' },
  'profile.newPlayer': { en: 'New player', de: 'Neuer Spieler', ua: 'Новий гравець', ru: 'Новый игрок', az: 'Yeni oyunçu', tr: 'Yeni oyuncu' },
  'profile.unranked': { en: 'Unranked', de: 'Ohne Rang', ua: 'Без рангу', ru: 'Без ранга', az: 'Rangsız', tr: 'Sıralamasız' },
  'profile.countryNotSet': { en: 'Country not set', de: 'Land nicht festgelegt', ua: 'Країна не вказана', ru: 'Страна не указана', az: 'Ölkə qeyd edilməyib', tr: 'Ülke belirtilmemiş' },
  'profile.rankingUnavailable': { en: 'Global ranking is not available yet.', de: 'Globale Rangliste noch nicht verfügbar.', ua: 'Глобальний рейтинг ще недоступний.', ru: 'Глобальный рейтинг пока недоступен.', az: 'Qlobal reytinq hələ mövcud deyil.', tr: 'Küresel sıralama henüz mevcut değil.' },
  'profile.ratingUnavailable': { en: 'Rating unavailable', de: 'Bewertung nicht verfügbar', ua: 'Рейтинг недоступний', ru: 'Рейтинг недоступен', az: 'Reytinq mövcud deyil', tr: 'Puan kullanılamıyor' },

  // Settings screen
  'settings.subtitle': { en: 'Configuration & Appearance', de: 'Konfiguration & Aussehen', ua: 'Конфігурація та зовнішній вигляд', ru: 'Конфигурация и внешний вид', az: 'Konfiqurasiya və Görünüş', tr: 'Yapılandırma ve Görünüm' },
  'settings.livePreview': { en: 'Live HD Preview', de: 'Live HD-Vorschau', ua: 'Огляд HD наживо', ru: 'Предварительный просмотр HD', az: 'Canlı HD Önizləmə', tr: 'Canlı HD Önizleme' },
  'settings.rendering': { en: 'Rendering', de: 'Rendering', ua: 'Рендеринг', ru: 'Рендеринг', az: 'Render', tr: 'İşleme' },
  'settings.boardEngine': { en: 'Board Engine', de: 'Board-Engine', ua: 'Рушій дошки', ru: 'Движок доски', az: 'Taxta Mühərriki', tr: 'Tahta Motoru' },
  'settings.pieceSet': { en: 'Piece Set', de: 'Figurenset', ua: 'Набір фігур', ru: 'Набор фигур', az: 'Fiqur Dəsti', tr: 'Taş Seti' },
  'settings.experimentalVFX': { en: 'Experimental VFX & Shaders', de: 'Experimentelle VFX & Shaders', ua: 'Експериментальні VFX та шейдери', ru: 'Экспериментальные VFX и шейдеры', az: 'Eksperimental VFX və PBR Şeyderlər', tr: 'Deneysel VFX ve PBR Gölgelendiriciler' },

  // Play screen
  'play.opponent': { en: 'Opponent', de: 'Gegner', ua: 'Суперник', ru: 'Соперник', az: 'Rəqib', tr: 'Rakip' },
  'play.eliteRating': { en: 'ELITE • 2850 RATING', de: 'ELITE • 2850 BEWERTUNG', ua: 'ЕЛІТА • 2850 РЕЙТИНГ', ru: 'ЭЛИТА • 2850 РЕЙТИНГ', az: 'ELİT • 2850 REYTİNQ', tr: 'ELİT • 2850 PUAN' },
  'play.waiting': { en: 'Waiting...', de: 'Warten...', ua: 'Очікування...', ru: 'Ожидание...', az: 'Gözlənilir...', tr: 'Bekleniyor...' },
  'play.directLink': { en: 'DIRECT LINK', de: 'DIREKTER LINK', ua: 'ПРЯМЕ ПОСИЛАННЯ', ru: 'ПРЯМАЯ ССЫЛКА', az: 'BİRBAŞA LİNK', tr: 'DOĞRUDAN BAĞLANTI' },
  'play.communityLabel': { en: 'COMMUNITY', de: 'COMMUNITY', ua: 'СПІЛЬНОТА', ru: 'СООБЩЕСТВО', az: 'İCMA', tr: 'TOPLULUK' },

  // Layout sidebar
  'layout.localization': { en: 'Localization', de: 'Lokalisierung', ua: 'Локалізація', ru: 'Локализация', az: 'Lokalizasiya', tr: 'Yerelleştirme' },
  'layout.regionInfo': { en: 'Region: Azerbaijan', de: 'Region: Aserbaidschan', ua: 'Регіон: Азербайджан', ru: 'Регион: Азербайджан', az: 'Region: Azərbaycan', tr: 'Bölge: Azerbaycan' },

  // Topbar
  'topbar.search': { en: 'Search', de: 'Suche', ua: 'Пошук', ru: 'Поиск', az: 'Axtarış', tr: 'Ara' },

  // Home Dashboard
  'home.dashboard.title': { en: 'Dashboard', de: 'Dashboard', ua: 'Панель управління', ru: 'Панель управления', az: 'İdarə Paneli', tr: 'Kontrol Paneli' },
  'home.dashboard.continue': { en: 'Continue Match', de: 'Match fortsetzen', ua: 'Продовжити матч', ru: 'Продолжить матч', az: 'Matça Davam Et', tr: 'Maça Devam Et' },
  'home.dashboard.analysis': { en: 'Latest Analysis', de: 'Letzte Analyse', ua: 'Останній аналіз', ru: 'Последний анализ', az: 'Son Analiz', tr: 'Son Analiz' },
  'home.dashboard.community': { en: 'Activity', de: 'Aktivität', ua: 'Активність', ru: 'Активность', az: 'Fəaliyyət', tr: 'Etkinlik' },
  'home.dashboard.tournament': { en: 'Daily Tournament', de: 'Tägliches Turnier', ua: 'Щоденний турнір', ru: 'Ежедневный турнир', az: 'Gündəlik Turnir', tr: 'Günlük Turnuva' },

  // Sidebar
  'sidebar.nav': { en: 'NAVIGATION', de: 'NAVIGATION', ua: 'НАВІГАЦІЯ', ru: 'НАВИГАЦИЯ', az: 'NAVİQASİYA', tr: 'NAVİGASYON' },
  'sidebar.system': { en: 'SYSTEM', de: 'SYSTEM', ua: 'СИСТЕМА', ru: 'СИСТЕМА', az: 'SİSTEM', tr: 'SİSTEM' },
  'sidebar.account': { en: 'ACCOUNT', de: 'KONTO', ua: 'АКАУНТ', ru: 'АККАУНТ', az: 'HESAB', tr: 'HESAP' },

  // Settings
  'settings.reset': { en: 'Reset to Default', de: 'Auf Standard zurücksetzen', ua: 'Скинути за замовчуванням', ru: 'Сбросить по умолчанию', az: 'Standartlara Sıfırla', tr: 'Varsayılanlara Sıfırla' },
  'settings.appearance': { en: 'Appearance', de: 'Aussehen', ua: 'Зовнішній вигляд', ru: 'Внешний вид', az: 'Görünüş', tr: 'Görünüm' },
  'settings.preferences': { en: 'System Preferences', de: 'Systemeinstellungen', ua: 'Налаштування системи', ru: 'Настройки системы', az: 'Sistem Ayarları', tr: 'Sistem Ayarları' },
  'settings.activeTheme': { en: 'Active Theme', de: 'Aktives Theme', ua: 'Активна тема', ru: 'Активная тема', az: 'Aktiv Tema', tr: 'Aktif Tema' },
  'settings.interfaceTheme': {
    en: 'Interface Theme',
    de: 'Oberflächendesign',
    ua: 'Тема інтерфейсу',
    ru: 'Тема интерфейса',
    az: 'İnterfeys Teması',
    tr: 'Arayüz Teması'
  },
  'settings.boardTheme': {
    en: 'Board Theme',
    de: 'Brettdesign',
    ua: 'Тема дошки',
    ru: 'Тема доски',
    az: 'Taxta Teması',
    tr: 'Tahta Teması'
  },
  'settings.appTheme': {
    en: 'App Theme',
    de: 'App-Design',
    ua: 'Тема застосунку',
    ru: 'Тема приложения',
    az: 'Tətbiq Teması',
    tr: 'Uygulama Teması'
  },
  'settings.restoreDefaults': {
    en: 'Restore Defaults',
    de: 'Standardeinstellungen wiederherstellen',
    ua: 'Відновити стандартні налаштування',
    ru: 'Восстановить настройки по умолчанию',
    az: 'Standart Parametrləri Bərpa Et',
    tr: 'Varsayılanları Geri Yükle'
  },
  'settings.saved': {
    en: 'Saved',
    de: 'Gespeichert',
    ua: 'Збережено',
    ru: 'Сохранено',
    az: 'Yadda saxlanıldı',
    tr: 'Kaydedildi'
  },

  'home.stats.live.value': { en: 'Live', de: 'Live', ua: 'Онлайн', ru: 'Онлайн', az: 'Canlı', tr: 'Canlı' },
  'home.stats.live.label': { en: 'Online Play', de: 'Online-Spiel', ua: 'Гра', ru: 'Игра', az: 'Oyun', tr: 'Oyun' },
  'home.stats.friend.value': { en: 'Friend', de: 'Freund', ua: 'Друг', ru: 'Друг', az: 'Dost', tr: 'Arkadaş' },
  'home.stats.friend.label': { en: 'Private Link', de: 'Privatlink', ua: 'Приватне посилання', ru: 'Приватная ссылка', az: 'Şəxsi link', tr: 'Özel link' },
  'home.stats.languages.value': { en: '6', de: '6', ua: '6', ru: '6', az: '6', tr: '6' },
  'home.stats.languages.label': { en: 'Languages', de: 'Sprachen', ua: 'Мов', ru: 'Языков', az: 'Dil', tr: 'Dil' },
  
  'home.playNow.subtitle': { en: 'Quick Match · Live Multiplayer', de: 'Schnellspiel · Online-Multiplayer', ua: 'Швидка гра · Онлайн-мультиплеєр', ru: 'Быстрая игра · Онлайн-мультиплеер', az: 'Sürətli oyun · Onlayn multiplayer', tr: 'Hızlı oyun · Online çok oyunculu' },
  'play.matchmakingStatus': { en: 'matchmaking', de: 'Matchmaking', ua: 'пошук гри', ru: 'поиск игры', az: 'matç axtarışı', tr: 'eşleştirme' },
  
  'play.liveStatus': { en: 'LIVE', de: 'LIVE', ua: 'ОНЛАЙН', ru: 'ОНЛАЙН', az: 'CANLI', tr: 'CANLI' },
  'play.playerMode': { en: 'Player Mode', de: 'Spielermodus', ua: 'Режим гравця', ru: 'Режим игрока', az: 'Oyunçu rejimi', tr: 'Oyuncu modu' },
  'play.guestMode': { en: 'Guest Mode', de: 'Gastmodus', ua: 'Гостьовий режим', ru: 'Гостевой режим', az: 'Qonaq rejimi', tr: 'Misafir modu' },

  'auth.signIn': { en: 'Sign In', ru: 'Войти', az: 'Daxil ol', tr: 'Giriş Yap', ua: 'Увійти', de: 'Anmelden' },
  'auth.register': { en: 'Register', ru: 'Регистрация', az: 'Qeydiyyat', tr: 'Kayıt Ol', ua: 'Реєстрація', de: 'Registrieren' },
  'auth.emailLabel': { en: 'Email Address', ru: 'Электронная почта', az: 'Elektron poçt', tr: 'E-posta Adresi', ua: 'Електронна пошта', de: 'E-Mail-Adresse' },
  'auth.passwordLabel': { en: 'Password', ru: 'Пароль', az: 'Şifrə', tr: 'Şifre', ua: 'Пароль', de: 'Passwort' },
  'auth.usernameLabel': { en: 'Username', ru: 'Имя пользователя', az: 'İstifadəçi adı', tr: 'Kullanıcı Adı', ua: 'Ім\'я користувача', de: 'Benutzername' },
  'auth.submitLogin': { en: 'Sign In', ru: 'Войти', az: 'Daxil ol', tr: 'Giriş Yap', ua: 'Увійти', de: 'Anmelden' },
  'auth.submitRegister': { en: 'Create Account', ru: 'Создать аккаунт', az: 'Hesab yarat', tr: 'Hesap Oluştur', ua: 'Створити акаунт', de: 'Konto erstellen' },
  'auth.forgotPassword': { en: 'Forgot password?', ru: 'Забыли пароль?', az: 'Şifrəni unutmusunuz?', tr: 'Şifrenizi mi unuttunuz?', ua: 'Забули пароль?', de: 'Passwort vergessen?' },
  'auth.emailLinkLogin': { en: 'Sign in with email link', ru: 'Войти по ссылке на email', az: 'Email linki ilə daxil ol', tr: 'E-posta bağlantısıyla giriş yap', ua: 'Увійти за посиланням на email', de: 'Mit E-Mail-Link anmelden' },
  'auth.or': { en: 'or', ru: 'или', az: 'və ya', tr: 'veya', ua: 'або', de: 'oder' },
  'auth.emailRequired': { en: 'Please enter your email address first.', ru: 'Сначала введите электронную почту.', az: 'Əvvəlcə elektron poçtunuzu daxil edin.', tr: 'Önce e-posta adresinizi girin.', ua: 'Спочатку введіть електронну пошту.', de: 'Bitte geben Sie zuerst Ihre E-Mail-Adresse ein.' },
  'auth.resetEmailSent': { en: 'Password reset email sent. Check your inbox.', ru: 'Письмо для сброса пароля отправлено. Проверьте почту.', az: 'Şifrə sıfırlama məktubu göndərildi. Poçtunuzu yoxlayın.', tr: 'Şifre sıfırlama e-postası gönderildi. Gelen kutunuzu kontrol edin.', ua: 'Лист для скидання пароля надіслано. Перевірте пошту.', de: 'E-Mail zum Zurücksetzen des Passworts wurde gesendet. Bitte prüfen Sie Ihr Postfach.' },
  'auth.magicLinkSent': { en: 'Magic link sent. Check your inbox.', ru: 'Ссылка для входа отправлена. Проверьте почту.', az: 'Daxil olma linki göndərildi. Poçtunuzu yoxlayın.', tr: 'Giriş bağlantısı gönderildi. Gelen kutunuzu kontrol edin.', ua: 'Посилання для входу надіслано. Перевірте пошту.', de: 'Anmeldelink wurde gesendet. Bitte prüfen Sie Ihr Postfach.' },
  'auth.recoveryError': { en: 'Something went wrong. Please try again.', ru: 'Что-то пошло не так. Попробуйте ещё раз.', az: 'Xəta baş verdi. Zəhmət olmasa yenidən cəhd edin.', tr: 'Bir hata oluştu. Lütfen tekrar deneyin.', ua: 'Щось пішло не так. Спробуйте ще раз.', de: 'Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.' },
  'auth.updatePasswordTitle': { en: 'Set new password', ru: 'Установить новый пароль', az: 'Yeni şifrə təyin et', tr: 'Yeni şifre belirle', ua: 'Встановити новий пароль', de: 'Neues Passwort festlegen' },
  'auth.newPasswordLabel': { en: 'New password', ru: 'Новый пароль', az: 'Yeni şifrə', tr: 'Yeni şifre', ua: 'Новий пароль', de: 'Neues Passwort' },
  'auth.confirmPasswordLabel': { en: 'Confirm password', ru: 'Подтвердите пароль', az: 'Şifrəni təsdiqlə', tr: 'Şifreyi onayla', ua: 'Підтвердіть пароль', de: 'Passwort bestätigen' },
  'auth.updatePasswordButton': { en: 'Update password', ru: 'Обновить пароль', az: 'Şifrəni yenilə', tr: 'Şifreyi güncelle', ua: 'Оновити пароль', de: 'Passwort aktualisieren' },
  'auth.passwordsDoNotMatch': { en: 'Passwords do not match.', ru: 'Пароли не совпадают.', az: 'Şifrələr uyğun gəlmir.', tr: 'Şifreler eşleşmiyor.', ua: 'Паролі не збігаються.', de: 'Die Passwörter stimmen nicht überein.' },
  'auth.passwordUpdated': { en: 'Password updated successfully.', ru: 'Пароль успешно обновлён.', az: 'Şifrə uğurla yeniləndi.', tr: 'Şifre başarıyla güncellendi.', ua: 'Пароль успішно оновлено.', de: 'Passwort erfolgreich aktualisiert.' },
  'auth.backToSignIn': { en: 'Back to sign in', ru: 'Вернуться ко входу', az: 'Girişə qayıt', tr: 'Girişe dön', ua: 'Повернутися до входу', de: 'Zur Anmeldung zurück' },
};
