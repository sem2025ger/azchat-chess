import type { Language } from '../../translations';
const fixedCopy: Record<string, Record<Language,string>> = {
  "Herausforderung zurückgezogen": {de: "Herausforderung zurückgezogen", en: "Challenge cancelled", az: "Çağırış ləğv edilib", tr: "Meydan okuma iptal edildi", ua: "Виклик скасовано", ru: "Вызов отменён"},
  "Herausforderung abgelaufen": {de: "Herausforderung abgelaufen", en: "Challenge expired", az: "Çağırışın vaxtı bitib", tr: "Meydan okumanın süresi doldu", ua: "Термін виклику минув", ru: "Срок вызова истёк"},
  "Nachricht gelöscht": {de: "Nachricht gelöscht", en: "Message deleted", az: "Mesaj silindi", tr: "Mesaj silindi", ua: "Повідомлення видалено", ru: "Сообщение удалено"},
  "Nachrichtenaktionen": {de: "Nachrichtenaktionen", en: "Message actions", az: "Mesaj əməliyyatları", tr: "Mesaj işlemleri", ua: "Дії з повідомленням", ru: "Действия с сообщением"},
  "Chat-Aktionen": {de: "Chat-Aktionen", en: "Chat actions", az: "Söhbət əməliyyatları", tr: "Sohbet işlemleri", ua: "Дії з чатом", ru: "Действия чата"},
  "Nachricht löschen": {de: "Nachricht löschen", en: "Delete message", az: "Mesajı sil", tr: "Mesajı sil", ua: "Видалити повідомлення", ru: "Удалить сообщение"},
  "Diese Nachricht dauerhaft aus dem Chat entfernen?": {de: "Diese Nachricht dauerhaft aus dem Chat entfernen?", en: "Permanently remove this message from the chat?", az: "Bu mesaj söhbətdən həmişəlik silinsin?", tr: "Bu mesaj sohbetten kalıcı olarak silinsin mi?", ua: "Назавжди видалити це повідомлення з чату?", ru: "Удалить это сообщение из чата навсегда?"},
  "Nachricht melden": {de: "Nachricht melden", en: "Report message", az: "Mesajı şikayət et", tr: "Mesajı bildir", ua: "Поскаржитися на повідомлення", ru: "Пожаловаться на сообщение"},
  "Grund der Meldung": {de: "Grund der Meldung", en: "Report reason", az: "Şikayətin səbəbi", tr: "Bildirim nedeni", ua: "Причина скарги", ru: "Причина жалобы"},
  "Spam": {de: "Spam", en: "Spam", az: "Spam", tr: "Spam", ua: "Спам", ru: "Спам"},
  "Beleidigung oder Belästigung": {de: "Beleidigung oder Belästigung", en: "Abuse or harassment", az: "Təhqir və ya təqib", tr: "Hakaret veya taciz", ua: "Образи або переслідування", ru: "Оскорбление или домогательство"},
  "Sonstiges": {de: "Sonstiges", en: "Other", az: "Digər", tr: "Diğer", ua: "Інше", ru: "Другое"},
  "Meldungen": {de: "Meldungen", en: "Reports", az: "Şikayətlər", tr: "Bildirimler", ua: "Скарги", ru: "Жалобы"},
  "Keine offenen Meldungen.": {de: "Keine offenen Meldungen.", en: "No pending reports.", az: "Açıq şikayət yoxdur.", tr: "Bekleyen bildirim yok.", ua: "Немає відкритих скарг.", ru: "Нет открытых жалоб."},
  "Nachricht wiederherstellen": {de: "Nachricht wiederherstellen", en: "Restore message", az: "Mesajı bərpa et", tr: "Mesajı geri yükle", ua: "Відновити повідомлення", ru: "Восстановить сообщение"},
  "Für Mitglieder ausgeblendet": {de: "Für Mitglieder ausgeblendet", en: "Hidden from members", az: "Üzvlərdən gizlədilib", tr: "Üyelerden gizlendi", ua: "Приховано від учасників", ru: "Скрыто от участников"},
  "Chat leeren": {de: "Chat leeren", en: "Clear chat", az: "Söhbəti təmizlə", tr: "Sohbeti temizle", ua: "Очистити чат", ru: "Очистить чат"},
  "Alle bisherigen Nachrichten in diesem Vereinschat dauerhaft entfernen?": {de: "Alle bisherigen Nachrichten in diesem Vereinschat dauerhaft entfernen?", en: "Permanently remove all existing messages in this club chat?", az: "Bu klub söhbətindəki bütün mövcud mesajlar həmişəlik silinsin?", tr: "Bu kulüp sohbetindeki mevcut tüm mesajlar kalıcı olarak silinsin mi?", ua: "Назавжди видалити всі наявні повідомлення з чату клубу?", ru: "Удалить все текущие сообщения чата клуба навсегда?"},
  "Alle Einladungslinks widerrufen": {de: "Alle Einladungslinks widerrufen", en: "Revoke all invite links", az: "Bütün dəvət keçidlərini ləğv et", tr: "Tüm davet bağlantılarını iptal et", ua: "Відкликати всі посилання-запрошення", ru: "Отозвать все ссылки-приглашения"},
  "Alle aktiven Einladungslinks dieses Vereins ungültig machen?": {de: "Alle aktiven Einladungslinks dieses Vereins ungültig machen?", en: "Expire all active invite links for this club?", az: "Bu klubun bütün aktiv dəvət keçidləri ləğv edilsin?", tr: "Bu kulübün tüm etkin davet bağlantıları geçersiz kılınsın mı?", ua: "Зробити всі активні посилання-запрошення клубу недійсними?", ru: "Сделать все действующие ссылки-приглашения клуба недействительными?"},
  "Ungelesene Nachrichten": {de: "Ungelesene Nachrichten", en: "Unread messages", az: "Oxunmamış mesajlar", tr: "Okunmamış mesajlar", ua: "Непрочитані повідомлення", ru: "Непрочитанные сообщения"},
  "Meldung gesendet.": {de: "Meldung gesendet.", en: "Report submitted.", az: "Şikayət göndərildi.", tr: "Bildirim gönderildi.", ua: "Скаргу надіслано.", ru: "Жалоба отправлена."},
  "Einladungslinks widerrufen.": {de: "Einladungslinks widerrufen.", en: "Invite links revoked.", az: "Dəvət keçidləri ləğv edildi.", tr: "Davet bağlantıları iptal edildi.", ua: "Посилання-запрошення відкликано.", ru: "Ссылки-приглашения отозваны."},
  "Nachrichten mit einer Herausforderung können nicht einzeln gelöscht werden.": {de: "Nachrichten mit einer Herausforderung können nicht einzeln gelöscht werden.", en: "Messages with a challenge cannot be deleted individually.", az: "Çağırış olan mesajları ayrı-ayrılıqda silmək olmur.", tr: "Meydan okuma içeren mesajlar tek tek silinemez.", ua: "Повідомлення з викликом не можна видаляти окремо.", ru: "Сообщение с вызовом нельзя удалить отдельно."},
  "Du hast diese Nachricht bereits gemeldet.": {de: "Du hast diese Nachricht bereits gemeldet.", en: "You already reported this message.", az: "Bu mesajı artıq şikayət etmisən.", tr: "Bu mesajı zaten bildirdin.", ua: "Ви вже поскаржилися на це повідомлення.", ru: "Вы уже пожаловались на это сообщение."},
  "Das Tageslimit von 20 Meldungen ist erreicht.": {de: "Das Tageslimit von 20 Meldungen ist erreicht.", en: "You reached the daily limit of 20 reports.", az: "Gündəlik 20 şikayət həddinə çatdın.", tr: "Günlük 20 bildirim sınırına ulaştın.", ua: "Ви досягли денного ліміту в 20 скарг.", ru: "Вы достигли дневного лимита в 20 жалоб."},
  "Nachricht": {de:"Nachricht",en:"Message",az:"Mesaj",tr:"Mesaj",ua:"Текст",ru:"Сообщение"},
  "Einladen": {de:"Einladen",en:"Invite",az:"Dəvət et",tr:"Davet et",ua:"Запросити",ru:"Пригласить"},
  "Angeheftete Nachricht bearbeiten": {de:"Angeheftete Nachricht bearbeiten",en:"Edit pinned message",az:"Bərkidilmiş mesajı redaktə et",tr:"Sabitlenen mesajı düzenle",ua:"Редагувати закріплене повідомлення",ru:"Редактировать закреплённое сообщение"},
  "Spieler herausfordern": {de:"Spieler herausfordern",en:"Challenge player",az:"Oyunçuya meydan oxu",tr:"Oyuncuya meydan oku",ua:"Кинути виклик гравцю",ru:"Вызвать игрока"},
  "Mehr anzeigen": {de:"Mehr anzeigen",en:"Show more",az:"Daha çox göstər",tr:"Daha fazla göster",ua:"Показати більше",ru:"Показать больше"},
  "Weniger anzeigen": {de:"Weniger anzeigen",en:"Show less",az:"Daha az göstər",tr:"Daha az göster",ua:"Показати менше",ru:"Показать меньше"},
  "+ Vereinschat erstellen": {de:"+ Vereinschat erstellen",en:"+ Create club chat",az:"+ Klub söhbəti yarat",tr:"+ Kulüp sohbeti oluştur",ua:"+ Створити чат клубу",ru:"+ Создать чат клуба"},
  "Allgemeiner Chat": {de:"Allgemeiner Chat",en:"General chat",az:"Ümumi söhbət",tr:"Genel sohbet",ua:"Загальний чат",ru:"Общий чат"},
  "Vereinschats": {de:"Vereinschats",en:"Club chats",az:"Klub söhbətləri",tr:"Kulüp sohbetleri",ua:"Клубні чати",ru:"Клубные чаты"},
  "← Allgemeiner Chat": {de:"← Allgemeiner Chat",en:"← General chat",az:"← Ümumi söhbət",tr:"← Genel sohbet",ua:"← Загальний чат",ru:"← Общий чат"},
  "Geschlossener Chat nur für Mitglieder deines Vereins. Erstelle einen Vereinschat oder nimm eine Einladung an.": {de:"Geschlossener Chat nur für Mitglieder deines Vereins. Erstelle einen Vereinschat oder nimm eine Einladung an.",en:"A private chat for your club members. Create a club chat or accept an invitation.",az:"Qapalı söhbət yalnız klubunuzun üzvləri üçündür. Klub söhbəti yaradın və ya dəvəti qəbul edin.",tr:"Yalnızca kulübünün üyelerine özel sohbet. Bir kulüp sohbeti oluştur veya daveti kabul et.",ua:"Закритий чат лише для учасників вашого клубу. Створіть чат клубу або прийміть запрошення.",ru:"Закрытый чат только для участников вашего клуба. Создайте чат клуба или примите приглашение."},
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
  "Partie beendet": {
    "de": "Partie beendet",
    "en": "Game over",
    "az": "Partiya bitdi",
    "tr": "Oyun bitti",
    "ua": "Партію завершено",
    "ru": "Партия завершена"
  },
  "Zur Partie": {
    "de": "Zur Partie",
    "en": "Open game",
    "az": "Partiyaya keç",
    "tr": "Oyuna git",
    "ua": "Відкрити партію",
    "ru": "Открыть партию"
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
  },
  "Rangliste folgt mit der Elo-Wertung": {
    "de": "Rangliste folgt mit der Elo-Wertung",
    "en": "Rankings will arrive with Elo ratings",
    "az": "Reytinq cədvəli Elo ilə gələcək",
    "tr": "Sıralama Elo puanlarıyla gelecek",
    "ua": "Рейтинг з’явиться разом з Elo",
    "ru": "Рейтинг появится вместе с Elo"
  },
  "Turniere starten bald": {
    "de": "Turniere starten bald",
    "en": "Tournaments are coming soon",
    "az": "Turnirlər tezliklə başlayacaq",
    "tr": "Turnuvalar yakında başlayacak",
    "ua": "Турніри скоро розпочнуться",
    "ru": "Турниры скоро начнутся"
  },
  "Schweizer System und Arena direkt im Schach-Treff. Wir sagen dir Bescheid, sobald das erste Turnier offen ist.": {
    "de": "Schweizer System und Arena direkt im Schach-Treff. Wir sagen dir Bescheid, sobald das erste Turnier offen ist.",
    "en": "Swiss-system and Arena tournaments in Schach-Treff. We will notify you when the first tournament opens.",
    "az": "Schach-Treff-də İsveçrə sistemi və Arena turnirləri. İlk turnir açılanda sizə xəbər verəcəyik.",
    "tr": "Schach-Treff’te İsviçre sistemi ve Arena turnuvaları. İlk turnuva açılınca haber vereceğiz.",
    "ua": "Швейцарська система й Арена у Schach-Treff. Повідомимо про перший турнір.",
    "ru": "Швейцарская система и Арена в Schach-Treff. Сообщим об открытии первого турнира."
  },
  "Der Schach-Treff ist der Raum auf ChessAZ für alle, die Schach auf Deutsch spielen und besprechen: Vereinsspieler, Turnierspieler und Hobbyspieler. Höflich, sachlich, ohne Werbung.": {
    "de": "Der Schach-Treff ist der Raum auf ChessAZ für alle, die Schach auf Deutsch spielen und besprechen: Vereinsspieler, Turnierspieler und Hobbyspieler. Höflich, sachlich, ohne Werbung.",
    "en": "Schach-Treff is the ChessAZ room for German-speaking chess players of every level. Be respectful; no advertising.",
    "az": "Schach-Treff, ChessAZ-da almandilli şahmatçılar üçün ümumi otaqdır. Nəzakətli olun, reklam etməyin.",
    "tr": "Schach-Treff, ChessAZ'da Almanca konuşan satranç oyuncuları içindir. Saygılı olun, reklam yok.",
    "ua": "Schach-Treff — простір ChessAZ для німецькомовних шахістів. Спілкуйтеся ввічливо, без реклами.",
    "ru": "Schach-Treff — пространство ChessAZ для немецкоязычных шахматистов. Общайтесь вежливо, без рекламы."
  },
  "Die Daten konnten nicht geladen oder gespeichert werden. Bitte versuche es erneut.": {
    "de": "Die Daten konnten nicht geladen oder gespeichert werden. Bitte versuche es erneut.",
    "en": "Could not load or save data. Please try again.",
    "az": "Məlumat yüklənmədi və ya saxlanılmadı. Yenidən cəhd edin.",
    "tr": "Veriler yüklenemedi veya kaydedilemedi. Tekrar deneyin.",
    "ua": "Не вдалося завантажити або зберегти дані. Спробуйте ще раз.",
    "ru": "Не удалось загрузить или сохранить данные. Повторите попытку."
  },
  "Noch keine Nachrichten. Teile den Einladungslink mit deinem Verein.": {
    "de": "Noch keine Nachrichten. Teile den Einladungslink mit deinem Verein.",
    "en": "No messages yet. Share the invitation with your club.",
    "az": "Hələ mesaj yoxdur. Dəvət linkini klubunuzla paylaşın.",
    "tr": "Henüz mesaj yok. Davet bağlantısını kulübünüzle paylaşın.",
    "ua": "Повідомлень ще немає. Надішліть запрошення клубу.",
    "ru": "Сообщений пока нет. Поделитесь ссылкой-приглашением с клубом."
  },
  "Tritt dem Club bei, um die Nachrichten zu sehen.": {
    "de": "Tritt dem Club bei, um die Nachrichten zu sehen.",
    "en": "Join the club to view messages.",
    "az": "Mesajları görmək üçün kluba qoşulun.",
    "tr": "Mesajları görmek için kulübe katılın.",
    "ua": "Приєднайтеся до клубу, щоб бачити повідомлення.",
    "ru": "Вступите в клуб, чтобы видеть сообщения."
  },
  "Dieser Raum hat bereits zehn aktive Links. Verwende einen bereits versendeten Link; neue sind nach Ablauf der alten möglich.": {
    "de": "Es gibt bereits 10 aktive Einladungslinks. Verwende einen bereits versendeten; neue können erstellt werden, sobald die alten abgelaufen sind.",
    "en": "There are already 10 active invitation links. Use one you've sent before; new ones can be created when the old ones expire.",
    "az": "Artıq 10 aktiv dəvət linki var. Daha əvvəl göndərilən linkdən istifadə edin; köhnələrin vaxtı bitdikdə yenilərini yaratmaq olar.",
    "tr": "Zaten 10 etkin davet bağlantısı var. Daha önce gönderdiğinizi kullanın; eskileri sona erince yenilerini oluşturabilirsiniz.",
    "ua": "Уже є 10 активних посилань-запрошень. Скористайтеся раніше надісланим; нові можна буде створити після завершення терміну дії старих.",
    "ru": "Уже есть 10 действующих ссылок. Используйте ранее отправленную — новые можно будет создать, когда старые истекут."
  },
  "Diese Aktion ist nicht erlaubt.": {
    "de": "Diese Aktion ist nicht erlaubt.",
    "en": "This action is not allowed.",
    "az": "Bu əməliyyata icazə verilmir.",
    "tr": "Bu işleme izin verilmiyor.",
    "ua": "Ця дія заборонена.",
    "ru": "Это действие запрещено."
  },
  "Der Name muss 3–60 Zeichen lang sein.": {
    "de": "Der Name muss 3–60 Zeichen lang sein.",
    "en": "Name must be 3–60 characters.",
    "az": "Ad 3–60 simvol olmalıdır.",
    "tr": "Ad 3–60 karakter olmalı.",
    "ua": "Назва має містити 3–60 символів.",
    "ru": "Название должно содержать 3–60 символов."
  },
  "Du kannst höchstens zwei Vereinsräume erstellen.": {
    "de": "Du kannst höchstens zwei Vereinsräume erstellen.",
    "en": "You can create up to two club rooms.",
    "az": "Ən çox iki klub otağı yarada bilərsiniz.",
    "tr": "En fazla iki kulüp odası açabilirsiniz.",
    "ua": "Можна створити не більше двох клубних кімнат.",
    "ru": "Можно создать не более двух клубных комнат."
  },
  "Dieser Einladungslink ist ungültig.": {
    "de": "Dieser Einladungslink ist ungültig.",
    "en": "Invalid invitation link.",
    "az": "Dəvət linki yanlışdır.",
    "tr": "Davet bağlantısı geçersiz.",
    "ua": "Недійсне посилання-запрошення.",
    "ru": "Недействительная ссылка-приглашение."
  },
  "Dieser Einladungslink ist abgelaufen.": {
    "de": "Dieser Einladungslink ist abgelaufen.",
    "en": "Invitation link has expired.",
    "az": "Dəvət linkinin vaxtı bitib.",
    "tr": "Davet bağlantısının süresi doldu.",
    "ua": "Термін дії запрошення минув.",
    "ru": "Срок действия приглашения истёк."
  },
  "Dieser Einladungslink wurde bereits vollständig verwendet.": {
    "de": "Dieser Einladungslink wurde bereits vollständig verwendet.",
    "en": "This invitation link has reached its use limit.",
    "az": "Dəvət linkinin istifadə limiti dolub.",
    "tr": "Davet bağlantısının kullanım sınırı doldu.",
    "ua": "Ліміт використань цього запрошення вичерпано.",
    "ru": "Лимит использований приглашения исчерпан."
  },
  "Beide Spieler müssen Mitglieder des Raums sein.": {
    "de": "Beide Spieler müssen Mitglieder des Raums sein.",
    "en": "Both players must be room members.",
    "az": "Hər iki oyunçu otağın üzvü olmalıdır.",
    "tr": "İki oyuncu da odanın üyesi olmalı.",
    "ua": "Обидва гравці мають бути учасниками кімнати.",
    "ru": "Оба игрока должны быть участниками комнаты."
  },
  "Die Herausforderung ist abgelaufen.": {
    "de": "Die Herausforderung ist abgelaufen.",
    "en": "The challenge has expired.",
    "az": "Çağırışın vaxtı bitib.",
    "tr": "Meydan okumanın süresi doldu.",
    "ua": "Термін виклику минув.",
    "ru": "Срок вызова истёк."
  },
  "Diese Herausforderung ist nicht mehr verfügbar.": {
    "de": "Diese Herausforderung ist nicht mehr verfügbar.",
    "en": "This challenge is no longer available.",
    "az": "Bu çağırış artıq əlçatan deyil.",
    "tr": "Bu meydan okuma artık kullanılamıyor.",
    "ua": "Цей виклик більше недоступний.",
    "ru": "Этот вызов больше недоступен."
  },
  "Du kannst höchstens drei offene Herausforderungen haben.": {
    "de": "Du kannst höchstens drei offene Herausforderungen haben.",
    "en": "You can have at most three open challenges.",
    "az": "Ən çox üç açıq çağırışınız ola bilər.",
    "tr": "En fazla üç açık meydan okumanız olabilir.",
    "ua": "Можна мати не більше трьох відкритих викликів.",
    "ru": "Можно иметь не больше трёх открытых вызовов."
  },
  "Diese Bedenkzeit ist nicht verfügbar.": {
    "de": "Diese Bedenkzeit ist nicht verfügbar.",
    "en": "This time control is unavailable.",
    "az": "Bu vaxt nəzarəti əlçatan deyil.",
    "tr": "Bu zaman kontrolü kullanılamıyor.",
    "ua": "Такий контроль часу недоступний.",
    "ru": "Этот контроль времени недоступен."
  },
  "Der Herausforderer ist nicht mehr online.": {
    "de": "Der Herausforderer ist nicht mehr online.",
    "en": "The challenger is offline.",
    "az": "Çağırış edən artıq onlayn deyil.",
    "tr": "Meydan okuyan artık çevrimdışı.",
    "ua": "Гравець, який кинув виклик, уже не в мережі.",
    "ru": "Игрок, бросивший вызов, уже не в сети."
  },
  "Ein Spieler ist gerade nicht verfügbar.": {
    "de": "Ein Spieler ist gerade nicht verfügbar.",
    "en": "One player is unavailable.",
    "az": "Oyunçulardan biri hazırda əlçatan deyil.",
    "tr": "Oyunculardan biri şu anda müsait değil.",
    "ua": "Один із гравців зараз недоступний.",
    "ru": "Один из игроков сейчас недоступен."
  },
  "Bitte warte kurz und versuche es erneut.": {
    "de": "Bitte warte kurz und versuche es erneut.",
    "en": "Please wait and try again.",
    "az": "Bir az gözləyib yenidən cəhd edin.",
    "tr": "Biraz bekleyip yeniden deneyin.",
    "ua": "Зачекайте й спробуйте ще раз.",
    "ru": "Подождите и повторите попытку."
  },
  "Die Partie kann gerade nicht sicher gestartet werden.": {
    "de": "Die Partie kann gerade nicht sicher gestartet werden.",
    "en": "The game cannot be started safely right now.",
    "az": "Partiyanı indi təhlükəsiz başlatmaq mümkün deyil.",
    "tr": "Oyun şu anda güvenli başlatılamıyor.",
    "ua": "Зараз не можна безпечно почати партію.",
    "ru": "Сейчас нельзя безопасно начать партию."
  }
};
export const translateSchachTreff = (language: Language, text: string): string => fixedCopy[text]?.[language] || text;
