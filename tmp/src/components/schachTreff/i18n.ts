import type { Language } from '../../translations';
const fixedCopy: Record<string, Record<Language,string>> = {
  "Verein erstellen": {
    "de": "Verein erstellen",
    "en": "Create club",
    "az": "Klub yarat",
    "tr": "Kulüp oluştur",
    "ua": "Створити клуб",
    "ru": "Создать клуб"
  },
  "Name des Vereins": {
    "de": "Name des Vereins",
    "en": "Club name",
    "az": "Klubun adı",
    "tr": "Kulüp adı",
    "ua": "Назва клубу",
    "ru": "Название клуба"
  },
  "Raum erstellen": {
    "de": "Raum erstellen",
    "en": "Create room",
    "az": "Otaq yarat",
    "tr": "Oda oluştur",
    "ua": "Створити кімнату",
    "ru": "Создать комнату"
  },
  "Link kopieren": {
    "de": "Link kopieren",
    "en": "Copy link",
    "az": "Linki kopyala",
    "tr": "Bağlantıyı kopyala",
    "ua": "Копіювати посилання",
    "ru": "Скопировать ссылку"
  },
  "Link kopiert": {
    "de": "Link kopiert",
    "en": "Link copied",
    "az": "Link kopyalandı",
    "tr": "Bağlantı kopyalandı",
    "ua": "Посилання скопійовано",
    "ru": "Ссылка скопирована"
  },
  "Einladungslink": {
    "de": "Einladungslink",
    "en": "Invitation link",
    "az": "Dəvət linki",
    "tr": "Davet bağlantısı",
    "ua": "Посилання-запрошення",
    "ru": "Ссылка-приглашение"
  },
  "Dein Einladungslink ist bereit.": {
    "de": "Dein Einladungslink ist bereit.",
    "en": "Your invitation link is ready.",
    "az": "Dəvət linkiniz hazırdır.",
    "tr": "Davet bağlantınız hazır.",
    "ua": "Ваше посилання-запрошення готове.",
    "ru": "Ваша ссылка-приглашение готова."
  },
  "Chat öffnen": {
    "de": "Chat öffnen",
    "en": "Open chat",
    "az": "Çatı aç",
    "tr": "Sohbeti aç",
    "ua": "Відкрити чат",
    "ru": "Открыть чат"
  },
  "Herausforderung": {
    "de": "Herausforderung",
    "en": "Challenge",
    "az": "Çağırış",
    "tr": "Meydan okuma",
    "ua": "Виклик",
    "ru": "Вызов"
  },
  "Herausfordern": {
    "de": "Herausfordern",
    "en": "Challenge player",
    "az": "Oyunçuya çağırış et",
    "tr": "Oyuncuya meydan oku",
    "ua": "Викликати гравця",
    "ru": "Вызвать игрока"
  },
  "Art der Herausforderung": {
    "de": "Art der Herausforderung",
    "en": "Challenge type",
    "az": "Çağırış növü",
    "tr": "Meydan okuma türü",
    "ua": "Тип виклику",
    "ru": "Тип вызова"
  },
  "Offen für alle": {
    "de": "Offen für alle",
    "en": "Open to everyone",
    "az": "Hamı üçün açıq",
    "tr": "Herkese açık",
    "ua": "Відкрито для всіх",
    "ru": "Открыто для всех"
  },
  "Persönliche Herausforderung": {
    "de": "Persönliche Herausforderung",
    "en": "Private challenge",
    "az": "Şəxsi çağırış",
    "tr": "Kişisel meydan okuma",
    "ua": "Особистий виклик",
    "ru": "Личный вызов"
  },
  "Offene Herausforderung": {
    "de": "Offene Herausforderung",
    "en": "Open challenge",
    "az": "Açıq çağırış",
    "tr": "Açık meydan okuma",
    "ua": "Відкритий виклик",
    "ru": "Открытый вызов"
  },
  "Bestimmter Spieler": {
    "de": "Bestimmter Spieler",
    "en": "Specific player",
    "az": "Müəyyən oyunçu",
    "tr": "Belirli oyuncu",
    "ua": "Конкретний гравець",
    "ru": "Конкретный игрок"
  },
  "Spieler auswählen": {
    "de": "Spieler auswählen",
    "en": "Select player",
    "az": "Oyunçu seç",
    "tr": "Oyuncu seç",
    "ua": "Вибрати гравця",
    "ru": "Выбрать игрока"
  },
  "Bedenkzeit": {
    "de": "Bedenkzeit",
    "en": "Time control",
    "az": "Vaxt nəzarəti",
    "tr": "Zaman kontrolü",
    "ua": "Контроль часу",
    "ru": "Контроль времени"
  },
  "Herausforderung senden": {
    "de": "Herausforderung senden",
    "en": "Send challenge",
    "az": "Çağırışı göndər",
    "tr": "Meydan okumayı gönder",
    "ua": "Надіслати виклик",
    "ru": "Отправить вызов"
  },
  "Partie": {
    "de": "Partie",
    "en": "Game",
    "az": "Partiya",
    "tr": "Oyun",
    "ua": "Партія",
    "ru": "Партия"
  },
  "Annehmen": {
    "de": "Annehmen",
    "en": "Accept",
    "az": "Qəbul et",
    "tr": "Kabul et",
    "ua": "Прийняти",
    "ru": "Принять"
  },
  "Abgelaufen": {
    "de": "Abgelaufen",
    "en": "Expired",
    "az": "Müddəti bitib",
    "tr": "Süresi doldu",
    "ua": "Термін минув",
    "ru": "Истекло"
  },
  "Abgebrochen": {
    "de": "Abgebrochen",
    "en": "Cancelled",
    "az": "Ləğv edildi",
    "tr": "İptal edildi",
    "ua": "Скасовано",
    "ru": "Отменено"
  },
  "Wartet auf Gegner": {
    "de": "Wartet auf Gegner",
    "en": "Waiting for opponent",
    "az": "Rəqib gözlənilir",
    "tr": "Rakip bekleniyor",
    "ua": "Очікування суперника",
    "ru": "Ожидание соперника"
  },
  "Partie startet …": {
    "de": "Partie startet …",
    "en": "Starting game…",
    "az": "Partiya başlayır…",
    "tr": "Oyun başlıyor…",
    "ua": "Партія починається…",
    "ru": "Партия начинается…"
  },
  "Partie gestartet": {
    "de": "Partie gestartet",
    "en": "Game started",
    "az": "Partiya başladı",
    "tr": "Oyun başladı",
    "ua": "Партія почалась",
    "ru": "Партия началась"
  },
  "Partien": {
    "de": "Partien",
    "en": "Games",
    "az": "Partiyalar",
    "tr": "Oyunlar",
    "ua": "Партії",
    "ru": "Партии"
  },
  "Letzte Partien": {
    "de": "Letzte Partien",
    "en": "Recent games",
    "az": "Son partiyalar",
    "tr": "Son oyunlar",
    "ua": "Останні партії",
    "ru": "Последние партии"
  },
  "Noch keine abgeschlossenen Partien.": {
    "de": "Noch keine abgeschlossenen Partien.",
    "en": "No completed games yet.",
    "az": "Hələ bitmiş partiya yoxdur.",
    "tr": "Henüz tamamlanmış oyun yok.",
    "ua": "Завершених партій ще немає.",
    "ru": "Завершённых партий пока нет."
  },
  "Angeheftet": {
    "de": "Angeheftet",
    "en": "Pinned",
    "az": "Bərkidilib",
    "tr": "Sabitlendi",
    "ua": "Закріплено",
    "ru": "Закреплено"
  },
  "Ändern": {
    "de": "Ändern",
    "en": "Change",
    "az": "Dəyiş",
    "tr": "Değiştir",
    "ua": "Змінити",
    "ru": "Изменить"
  },
  "Anheften": {
    "de": "Anheften",
    "en": "Pin",
    "az": "Bərkit",
    "tr": "Sabitle",
    "ua": "Закріпити",
    "ru": "Закрепить"
  },
  "Abbrechen": {
    "de": "Abbrechen",
    "en": "Cancel",
    "az": "Ləğv et",
    "tr": "İptal",
    "ua": "Скасувати",
    "ru": "Отмена"
  },
  "Weitere Bereiche": {
    "de": "Weitere Bereiche",
    "en": "More sections",
    "az": "Digər bölmələr",
    "tr": "Diğer bölümler",
    "ua": "Інші розділи",
    "ru": "Другие разделы"
  },
  "Räume": {
    "de": "Räume",
    "en": "Rooms",
    "az": "Otaqlar",
    "tr": "Odalar",
    "ua": "Кімнати",
    "ru": "Комнаты"
  },
  "Allgemein": {
    "de": "Allgemein",
    "en": "General",
    "az": "Ümumi",
    "tr": "Genel",
    "ua": "Загальний",
    "ru": "Общий"
  },
  "Meine Vereine": {
    "de": "Meine Vereine",
    "en": "My clubs",
    "az": "Mənim klublarım",
    "tr": "Kulüplerim",
    "ua": "Мої клуби",
    "ru": "Мои клубы"
  },
  "Turniere": {
    "de": "Turniere",
    "en": "Tournaments",
    "az": "Turnirlər",
    "tr": "Turnuvalar",
    "ua": "Турніри",
    "ru": "Турниры"
  },
  "bald": {
    "de": "bald",
    "en": "soon",
    "az": "tezliklə",
    "tr": "yakında",
    "ua": "незабаром",
    "ru": "скоро"
  },
  "Mitglieder": {
    "de": "Mitglieder",
    "en": "Members",
    "az": "Üzvlər",
    "tr": "Üyeler",
    "ua": "Учасники",
    "ru": "Участники"
  },
  "Rangliste": {
    "de": "Rangliste",
    "en": "Ranking",
    "az": "Reytinq cədvəli",
    "tr": "Sıralama",
    "ua": "Рейтинг",
    "ru": "Рейтинг"
  },
  "Über uns": {
    "de": "Über uns",
    "en": "About us",
    "az": "Haqqımızda",
    "tr": "Hakkımızda",
    "ua": "Про нас",
    "ru": "О нас"
  },
  "Benachrichtigen": {
    "de": "Benachrichtigen",
    "en": "Notify me",
    "az": "Mənə bildir",
    "tr": "Bana bildir",
    "ua": "Сповістити",
    "ru": "Уведомить"
  },
  "Wir melden uns": {
    "de": "Wir melden uns",
    "en": "We will notify you",
    "az": "Sizə bildirəcəyik",
    "tr": "Size haber vereceğiz",
    "ua": "Ми повідомимо",
    "ru": "Мы сообщим"
  },
  "Schließen": {
    "de": "Schließen",
    "en": "Close",
    "az": "Bağla",
    "tr": "Kapat",
    "ua": "Закрити",
    "ru": "Закрыть"
  },
  "Wird geladen …": {
    "de": "Wird geladen …",
    "en": "Loading…",
    "az": "Yüklənir…",
    "tr": "Yükleniyor…",
    "ua": "Завантаження…",
    "ru": "Загрузка…"
  },
  "Nachricht schreiben …": {
    "de": "Nachricht schreiben …",
    "en": "Write a message…",
    "az": "Mesaj yazın…",
    "tr": "Mesaj yazın…",
    "ua": "Написати повідомлення…",
    "ru": "Написать сообщение…"
  },
  "Senden": {
    "de": "Senden",
    "en": "Send",
    "az": "Göndər",
    "tr": "Gönder",
    "ua": "Надіслати",
    "ru": "Отправить"
  },
  "Community beitreten": {
    "de": "Community beitreten",
    "en": "Join community",
    "az": "İcmaya qoşul",
    "tr": "Topluluğa katıl",
    "ua": "Приєднатися до спільноти",
    "ru": "Вступить в сообщество"
  },
  "Anmelden": {
    "de": "Anmelden",
    "en": "Sign in",
    "az": "Daxil ol",
    "tr": "Giriş yap",
    "ua": "Увійти",
    "ru": "Войти"
  },
  "Der Raum ist noch nicht eingerichtet.": {
    "de": "Der Raum ist noch nicht eingerichtet.",
    "en": "The room is not set up yet.",
    "az": "Otaq hələ qurulmayıb.",
    "tr": "Oda henüz kurulmadı.",
    "ua": "Кімнату ще не налаштовано.",
    "ru": "Комната ещё не создана."
  },
  "Noch keine Mitglieder.": {
    "de": "Noch keine Mitglieder.",
    "en": "No members yet.",
    "az": "Hələ üzv yoxdur.",
    "tr": "Henüz üye yok.",
    "ua": "Учасників ще немає.",
    "ru": "Участников пока нет."
  },
  "Blitz": {
    "de": "Blitz",
    "en": "Blitz",
    "az": "Blits",
    "tr": "Blitz",
    "ua": "Бліц",
    "ru": "Блиц"
  },
  "Schnell": {
    "de": "Schnell",
    "en": "Rapid",
    "az": "Rapid",
    "tr": "Hızlı",
    "ua": "Рапід",
    "ru": "Рапид"
  },
  "Keine Angaben zu Ort und Verein": {
    "de": "Keine Angaben zu Ort und Verein",
    "en": "No city or club provided",
    "az": "Şəhər və klub göstərilməyib",
    "tr": "Şehir veya kulüp belirtilmedi",
    "ua": "Місто і клуб не вказано",
    "ru": "Город и клуб не указаны"
  },
  "gestern": {
    "de": "gestern",
    "en": "yesterday",
    "az": "dünən",
    "tr": "dün",
    "ua": "вчора",
    "ru": "вчера"
  }
};
export const translateSchachTreff = (language: Language, text: string): string => fixedCopy[text]?.[language] || text;
