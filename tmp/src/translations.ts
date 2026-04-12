export type Language = 'ru' | 'az' | 'tr';

type TranslationDictionary = Record<string, Record<Language, string>>;

export const translations: TranslationDictionary = {
  // Navigation & Layout
  'nav.home': { ru: 'Главная', az: 'Ana Səhifə', tr: 'Ana Sayfa' },
  'nav.play': { ru: 'Играть', az: 'Oyna', tr: 'Oyna' },
  'nav.game': { ru: 'Игра', az: 'Oyun', tr: 'Oyun' },
  'nav.chat': { ru: 'Чат', az: 'Söhbət', tr: 'Sohbet' },
  'nav.profile': { ru: 'Профиль', az: 'Profil', tr: 'Profil' },
  'nav.settings': { ru: 'Настройки', az: 'Ayarlar', tr: 'Ayarlar' },

  // Home Screen
  'home.title': { ru: 'Шахматная Платформа AZTR', az: 'AZTR Şahmat Platforması', tr: 'AZTR Satranç Platformu' },
  'home.subtitle': {
    ru: 'Премиальная шахматная платформа для Азербайджана, Турции и России. Общайтесь, соревнуйтесь и настраивайте свой опыт.',
    az: 'Azərbaycan, Türkiyə və Rusiya üçün premium onlayn şahmat ünvanı. Bağlan, yarış və təcrübəni fərdiləşdir.',
    tr: 'Azerbaycan, Türkiye ve Rusya için premium çevrimiçi satranç adresi. Bağlan, rekabet et ve deneyimini özelleştir.'
  },
  'home.playNow': { ru: 'Играть сейчас', az: 'İndi Oyna', tr: 'Şimdi Oyna' },
  'home.cards.play.title': { ru: 'Начать матч', az: 'Matç Oyna', tr: 'Maç Oyna' },
  'home.cards.play.desc': { ru: 'Найдите противника в Bullet, Blitz или Rapid.', az: 'Bullet, Blitz və ya Rapid rejimində rəqib tap.', tr: 'Bullet, Blitz veya Rapid modunda rakip bul.' },
  'home.cards.game.title': { ru: 'Активная игра', az: 'Aktiv Oyun', tr: 'Aktif Oyun' },
  'home.cards.game.desc': { ru: 'Вернитесь к своим текущим матчам или анализу.', az: 'Cari matçlarına və ya analizə qayıt.', tr: 'Mevcut maçlarına veya analize dön.' },
  'home.cards.profile.title': { ru: 'Рейтинг', az: 'Reytinq', tr: 'Sıralama' },
  'home.cards.profile.desc': { ru: 'Проверьте свой рейтинг и положение в стране.', az: 'Reytinqini və ölkə üzrə mövqeyini yoxla.', tr: 'Reytingini ve ülke sıralamanı kontrol et.' },
  'home.cards.chat.title': { ru: 'Сообщество', az: 'İcma', tr: 'Topluluk' },
  'home.cards.chat.desc': { ru: 'Присоединяйтесь к глобальному чату и заводите друзей.', az: 'Qlobal söhbətə qoşul və dostlar tap.', tr: 'Küresel sohbete katıl ve arkadaşlar edin.' },

  // Play Screen
  'play.tabs.play': { ru: 'Играть', az: 'Oyna', tr: 'Oyna' },
  'play.tabs.tournaments': { ru: 'Турниры', az: 'Turnirlər', tr: 'Turnuvalar' },
  'play.tabs.computer': { ru: 'Компьютер', az: 'Kompüter', tr: 'Bilgisayar' },
  'play.timeControl': { ru: 'Контроль времени', az: 'Vaxt Nəzarəti', tr: 'Zaman Kontrolü' },
  'play.matchType': { ru: 'Тип матча', az: 'Matç Növü', tr: 'Maç Türü' },
  'play.type.rated': { ru: 'Рейтинговый', az: 'Reytinqli', tr: 'Dereceli' },
  'play.type.casual': { ru: 'Товарищеский', az: 'Dostluq', tr: 'Dostluk' },
  'play.region': { ru: 'Регион', az: 'Region', tr: 'Bölge' },
  'play.region.global': { ru: 'Глобальный', az: 'Qlobal', tr: 'Küresel' },
  'play.startGame': { ru: 'НАЧАТЬ ИГРУ', az: 'OYUNA BAŞLA', tr: 'OYUNA BAŞLA' },
  'play.playersOnline': { ru: 'Игроков онлайн', az: 'Oyunçu Onlayn', tr: 'Oyuncu Çevrimiçi' },
  'play.searching': { ru: 'Поиск противника...', az: 'Rəqib axtarılır...', tr: 'Rakip aranıyor...' },
  'play.searchingDesc': { ru: 'Ожидание: < 10сек', az: 'Gözlənilən vaxt: < 10s', tr: 'Tahmini bekleme: < 10s' },
  'play.cancel': { ru: 'Отмена', az: 'Ləğv et', tr: 'İptal' },
  'play.friend': { ru: 'Играть с другом', az: 'Dostla Oyna', tr: 'Arkadaşla Oyna' },
  'play.tournaments': { ru: 'Присоединиться к турниру', az: 'Turnirə Qoşul', tr: 'Turnuvaya Katıl' },

  // Game Screen
  'game.tabs.moves': { ru: 'Ходы', az: 'Gedişlər', tr: 'Hamleler' },
  'game.tabs.chat': { ru: 'Чат', az: 'Söhbət', tr: 'Sohbet' },

  'game.chat.start': { ru: 'Матч начался! Удачи.', az: 'Matç başlayır! Uğurlar.', tr: 'Maç başlıyor! Bol şans.' },
  'game.chat.placeholder': { ru: 'Введите сообщение...', az: 'Mesaj yaz...', tr: 'Mesaj yaz...' },
  'game.resign': { ru: 'Сдаться', az: 'Təslim ol', tr: 'Terk Et' },
  'game.draw': { ru: 'Предложить ничью', az: 'Heç-heçə təklif et', tr: 'Beraberlik Teklif Et' },
  'game.white': { ru: 'Белые', az: 'Ağ', tr: 'Beyaz' },
  'game.black': { ru: 'Черные', az: 'Qara', tr: 'Siyah' },



  // Stockfish Analysis UI
  'game.tabs.analysis': { ru: 'Анализ', az: 'Analiz', tr: 'Analiz' },
  'game.analysis.engineLoading': { ru: 'Загрузка движка...', az: 'Mühərrik Yüklənir...', tr: 'Motor Yükleniyor...' },
  'game.analysis.bestMove': { ru: 'Лучший ход', az: 'Ən Yaxşı Gediş', tr: 'En İyi Hamle' },
  'game.analysis.candidates': { ru: 'Кандидаты', az: 'Namizəd Gedişlər', tr: 'Aday Hamleler' },
  'game.analysis.depth': { ru: 'Глубина', az: 'Dərinlik', tr: 'Derinlik' },
  'game.analysis.toggle': { ru: 'Включить анализ', az: 'Analizi Aktivləşdir', tr: 'Analizi Aç/Kapat' },
  'game.analysis.quality.best': { ru: 'Лучший', az: 'Əla', tr: 'En İyi' },
  'game.analysis.quality.good': { ru: 'Хороший', az: 'Yaxşı', tr: 'İyi' },
  'game.analysis.quality.inaccurate': { ru: 'Неточный', az: 'Qeyri-dəqiq', tr: 'Hatalı' },
  'game.analysis.quality.mistake': { ru: 'Ошибка', az: 'Səhv', tr: 'Yanlıш' },
  'game.analysis.quality.blunder': { ru: 'Зевок', az: 'Kobud Səhv', tr: 'Pot' },
  'game.analysis.detail': { ru: 'Детали оценки', az: 'Qiymətləndirmə detalları', tr: 'Değerlendirme detayları' },
  'game.analysis.qualityLabel': { ru: 'Оценка качества', az: 'Keyfiyyətin qiymətləndirilməsi', tr: 'Kalite değerlendirmesi' },
  'game.analysis.nomoves': { ru: 'Ходов еще нет', az: 'Hələ gediş yoxdur', tr: 'Henüz hamle yok' },
  'game.analysis.unavailable': { ru: 'Анализ недоступен', az: 'Analiz mümkün deyil', tr: 'Analiz kullanılamıyor' },
  'game.analysis.hint': { ru: 'Используйте линии движка вместе с советами тренера.', az: 'Məşqçinin məsləhətləri ilə birlikdə mühərrik xətlərindən istifadə edin.', tr: 'Antrenör tavsiyeleriyle birlikte motor hatlarını kullanın.' },

  // AI Chat Assistant UI
  'chat.assistant.title': { ru: 'Чат-помощник ИИ', az: 'Söhbət Köməkçisi', tr: 'Sohbet Yardımcısı' },
  'chat.assistant.translate': { ru: 'Перевести', az: 'Tərcümə Et', tr: 'Çevir' },
  'chat.assistant.translateBubble': { ru: 'Перевести на мой язык', az: 'Dilimə tərcümə et', tr: 'Dilime çevir' },
  'chat.assistant.polite': { ru: 'Вежливо', az: 'Nəzakətli Et', tr: 'Nazik Yap' },
  'chat.assistant.friendly': { ru: 'Дружелюбно', az: 'Səmimi Et', tr: 'Samimi Yap' },
  'chat.assistant.neutral': { ru: 'Нейтрально', az: 'Neytral Et', tr: 'Nötr Yap' },
  'chat.assistant.toxicityWarning': { ru: 'Предупреждение: это звучит агрессивно. Попробуйте спокойнее?', az: 'Təhlükəsizlik Xəbərdarlığı: Bu bir az aqressiv görünür. Daha sakit versiyanı sınayın?', tr: 'Güvenlik Uyarısı: Bu biraz agresif görünüyor. Daha sakin bir sürüm dener misiniz?' },
  'chat.assistant.phrases': { ru: 'Быстрые фразы', az: 'Tez Chess İfadələri', tr: 'Hızlı Satranç Иfadeleri' },
  'chat.assistant.terms': { ru: 'Термины', az: 'Şahmat Termini İzahları', tr: 'Satranç Terimi Açıklamaları' },
  'chat.assistant.suggestions': { ru: 'Быстрые ответы', az: 'Sürətli Cavablar', tr: 'Hızlı Cevaplar' },
  'chat.assistant.preview': { ru: 'Предпросмотр ИИ', az: 'Süni İntellekt Təklifi', tr: 'Yapay Zeka Önerisi' },
  'chat.assistant.insert': { ru: 'Вставить', az: 'Mətnə Əlavə Et', tr: 'Metne Ekle' },
  'chat.assistant.close': { ru: 'Закрыть помощника', az: 'Köməkçini Bağla', tr: 'Yardımcıyı Kapat' },

  // Chat Screen
  'chat.globalTitle': { ru: 'Глобальный чат', az: 'Qlobal Region Söhbəti', tr: 'Küresel Bölge Sohbeti' },
  'chat.subtitle': { ru: 'Азербайджан • Турция • Россия', az: 'Azərbaycan • Türkiyə • Rusiya', tr: 'Azerbaycan • Türkiye • Rusya' },
  'chat.onlineUsers': { ru: 'Пользователи онлайн', az: 'Onlayn İstifadəçilər', tr: 'Çevrimiçi Kullanıcılar' },
  'chat.sendPlaceholder': { ru: 'Отправить сообщение в глобальный чат...', az: 'Qlobal söhbətə mesaj göndər...', tr: 'Küresel sohbete mesaj gönder...' },

  // Profile Screen
  'profile.memberSince': { ru: 'В сообществе с', az: 'Üzvlük tarixi', tr: 'Üyelik tarihi' },
  'profile.performance': { ru: 'Результативность', az: 'Göstəricilər', tr: 'Performans' },
  'profile.wins': { ru: 'Победы', az: 'Qələbə', tr: 'Galibiyet' },
  'profile.draws': { ru: 'Ничьи', az: 'Heç-heçə', tr: 'Beraberlik' },
  'profile.losses': { ru: 'Поражения', az: 'Məğlubiyyət', tr: 'Mağlubiyet' },
  'profile.recentTrophies': { ru: 'Трофеи', az: 'Son Nailiyyətlər', tr: 'Son Başarılar' },
  'profile.recentGames': { ru: 'Последние игры', az: 'Son Oyunlar', tr: 'Son Oyunlar' },
  'profile.review': { ru: 'Обзор →', az: 'Baxış →', tr: 'İncele →' },

  // Settings Screen
  'settings.title': { ru: 'Настройки приложения', az: 'Tətbiq Ayarları', tr: 'Uygulama Ayarları' },
  'settings.changeLanguage': { ru: 'Изменить язык', az: 'Dili dəyişdir', tr: 'Dili değiştir' },
  'settings.specialThemes': { ru: 'Специальные темы', az: 'Xüsusi Mövzuları Aktivləşdir', tr: 'Özel Temaları Etkinleştir' },
  'settings.boardAppearance': { ru: 'Внешний вид доски', az: 'Lövhə Görünüşü', tr: 'Tahta Görünümü' },
  'settings.pieceStyles': { ru: 'Шахматные фигуры', az: 'Şahmat Fiqurları', tr: 'Satranç Taşları' },
  'settings.soundThemes': { ru: 'Звуковые темы', az: 'Səs Mövzuları', tr: 'Ses Temaları' },

  // Role Separation & Categories

  'game.analysis.dashboard': { ru: 'Панель инструментов движка', az: 'Mühərrik alətlər paneli', tr: 'Motor araç paneli' },
  'game.analysis.variations': { ru: 'Тактические варианты', az: 'Taktiki variantlar', tr: 'Taktik varyasyonlar' },
  'game.analysis.engineStatus': { ru: 'Статус движка', az: 'Mühərrik statusu', tr: 'Motor durumu' },
  'game.analysis.engineLabel': { ru: 'Тактический движок / UCI v2.0', az: 'Taktiki Mühərrik / UCI v2.0', tr: 'Taktik Motor / UCI v2.0' },
  'game.analysis.processActive': { ru: 'Процесс активен', az: 'Proses Aktiv', tr: 'İşlem Aktif' },
  'game.analysis.engineAwaiting': { ru: 'Движок ожидает данные матча', az: 'Mühərrik matç məlumatlarını gözləyir', tr: 'Motor maç verilerini bekliyor' },
  'game.analysis.engineFault': { ru: 'Критическая ошибка движка', az: 'Kritik Mühərrik Xətası', tr: 'Kritik Motor Hatası' },
  'game.analysis.multiLine': { ru: 'Многовариантный анализ', az: 'Çox xəttli analiz', tr: 'Çoklu hat analizi' },
  'game.analysis.lineLabel': { ru: 'Линия', az: 'Xətt', tr: 'Hat' },

  // Home screen
  'home.stats.players': { ru: 'Игроки', az: 'Oyunçular', tr: 'Oyuncular' },
  'home.stats.activeMatches': { ru: 'Активные матчи', az: 'Aktiv matçlar', tr: 'Aktif maçlar' },
  'home.stats.countries': { ru: 'Страны', az: 'Ölkələr', tr: 'Ülkeler' },
  'home.platformDemo': { ru: 'Премиальная шахматная платформа', az: 'Premium Şahmat Platforması', tr: 'Premium Satranç Platformu' },
  'home.explore': { ru: 'Исследовать', az: 'Kəşf et', tr: 'Keşfet' },

  // Chat screen
  'chat.communityHub': { ru: 'СООБЩЕСТВО', az: 'İCMA MƏRKƏZİ', tr: 'TOPLULUK MERKEZİ' },
  'chat.liveCount': { ru: 'В сети', az: 'Canlı', tr: 'Çevrimiçi' },
  'chat.youBadge': { ru: 'ВЫ', az: 'SİZ', tr: 'SİZ' },
  'chat.worldPlayers': { ru: 'Мировые игроки', az: 'Dünya Oyunçuları', tr: 'Dünya Oyuncuları' },
  'chat.joinQueue': { ru: 'Присоединиться', az: 'Növbəyə qoşul', tr: 'Sıraya katıl' },

  // Profile screen
  'profile.topPercent': { ru: 'ТОП 1%', az: 'TOP 1%', tr: 'TOP %1' },
  'profile.globalRank': { ru: 'Мировой рейтинг', az: 'Qlobal Sıralama', tr: 'Küresel Sıralama' },
  'profile.winRate': { ru: 'Процент побед', az: 'Qalibiyyət nisbəti', tr: 'Kazanma oranı' },
  'profile.viewHistory': { ru: 'Вся история', az: 'Bütün tarixçə', tr: 'Tüm geçmiş' },

  // Settings screen
  'settings.subtitle': { ru: 'Конфигурация и внешний вид', az: 'Konfiqurasiya və Görünüş', tr: 'Yapılandırma ve Görünüm' },
  'settings.livePreview': { ru: 'Предварительный просмотр HD', az: 'Canlı HD Önizləmə', tr: 'Canlı HD Önizleme' },
  'settings.rendering': { ru: 'Рендеринг', az: 'Render', tr: 'İşleme' },
  'settings.boardEngine': { ru: 'Движок доски', az: 'Taxta Mühərriki', tr: 'Tahta Motoru' },
  'settings.pieceSet': { ru: 'Набор фигур', az: 'Fiqur Dəsti', tr: 'Taş Seti' },
  'settings.experimentalVFX': { ru: 'Экспериментальные VFX и шейдеры', az: 'Eksperimental VFX və PBR Şeyderlər', tr: 'Deneysel VFX ve PBR Gölgelendiriciler' },

  // Play screen
  'play.eliteRating': { ru: 'ЭЛИТА • 2850 РЕЙТИНГ', az: 'ELİT • 2850 REYTİNQ', tr: 'ELİT • 2850 PUAN' },
  'play.waiting': { ru: 'Ожидание...', az: 'Gözlənilir...', tr: 'Bekleniyor...' },
  'play.directLink': { ru: 'ПРЯМАЯ ССЫЛКА', az: 'BİRBAŞA LİNK', tr: 'DOĞRUDAN BAĞLANTI' },
  'play.communityLabel': { ru: 'СООБЩЕСТВО', az: 'İCMA', tr: 'TOPLULUK' },

  // Layout sidebar
  'layout.localization': { ru: 'Локализация', az: 'Lokalizasiya', tr: 'Yerelleştirme' },
  'layout.regionInfo': { ru: 'Регион: Азербайджан', az: 'Region: Azərbaycan', tr: 'Bölge: Azerbaycan' },

  // Topbar
  'topbar.search': { ru: 'Поиск', az: 'Axtarış', tr: 'Ara' },

  // Home Dashboard
  'home.dashboard.title': { ru: 'Панель управления', az: 'İdarə Paneli', tr: 'Kontrol Paneli' },
  'home.dashboard.continue': { ru: 'Продолжить матч', az: 'Matça Davam Et', tr: 'Maça Devam Et' },
  'home.dashboard.analysis': { ru: 'Последний анализ', az: 'Son Analiz', tr: 'Son Analiz' },
  'home.dashboard.community': { ru: 'Активность', az: 'Fəaliyyət', tr: 'Etkinlik' },
  'home.dashboard.tournament': { ru: 'Ежедневный турнир', az: 'Gündəlik Turnir', tr: 'Günlük Turnuva' },

  // Sidebar
  'sidebar.nav': { ru: 'НАВИГАЦИЯ', az: 'NAVİQASİYA', tr: 'NAVİGASYON' },
  'sidebar.system': { ru: 'СИСТЕМА', az: 'SİSTEM', tr: 'SİSTEM' },
  'sidebar.account': { ru: 'АККАУНТ', az: 'HESAB', tr: 'HESAP' },

  // Settings
  'settings.reset': { ru: 'Сбросить по умолчанию', az: 'Standartlara Sıfırla', tr: 'Varsayılanlara Sıfırla' },
  'settings.appearance': { ru: 'Внешний вид', az: 'Görünüş', tr: 'Görünüm' },
  'settings.preferences': { ru: 'Настройки системы', az: 'Sistem Ayarları', tr: 'Sistem Ayarları' },
  'settings.activeTheme': { ru: 'Активная тема', az: 'Aktiv Tema', tr: 'Aktif Tema' },
};
