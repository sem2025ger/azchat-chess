export const copy = {
  pinned: 'Angeheftet', change: 'Ändern', pinAction: 'Anheften', cancel: 'Abbrechen',
  title: 'Schach-Treff', more: 'Weitere Bereiche', rooms: 'Räume', general: 'Allgemein', clubs: 'Meine Vereine',
  tournaments: 'Turniere', soon: 'bald', members: 'Mitglieder', ranking: 'Rangliste', about: 'Über uns',
  rankingSoon: 'Rangliste folgt mit der Elo-Wertung',
  tournamentTitle: 'Turniere starten bald', tournamentText: 'Schweizer System und Arena direkt im Schach-Treff. Wir sagen dir Bescheid, sobald das erste Turnier offen ist.',
  notify: 'Benachrichtigen', notified: 'Wir melden uns',
  aboutText: 'Der Schach-Treff ist der Raum auf ChessAZ für alle, die Schach auf Deutsch spielen und besprechen: Vereinsspieler, Turnierspieler und Hobbyspieler. Höflich, sachlich, ohne Werbung.',
  close: 'Schließen', loading: 'Wird geladen …', error: 'Die Daten konnten nicht geladen oder gespeichert werden. Bitte versuche es erneut.',
  empty: 'Noch keine Nachrichten. Teile den Einladungslink mit deinem Verein.', placeholder: 'Nachricht schreiben …', send: 'Senden',
  join: 'Community beitreten', login: 'Anmelden', joinHint: 'Tritt dem Club bei, um die Nachrichten zu sehen.',
  noClub: 'Der Raum ist noch nicht eingerichtet.', noMembers: 'Noch keine Mitglieder.', blitz: 'Blitz', rapid: 'Schnell',
  noLocation: 'Keine Angaben zu Ort und Verein', yesterday: 'gestern',
  reviewLanguage: 'Русский', reviewLanguageLabel: 'Интерфейс по-русски',
  reviewLanguageHint: 'Временный перевод интерфейса для проверки',
} as const;

// Temporary owner-review translation; German remains the default for Schach-Treff.
export const russianCopy: Record<keyof typeof copy, string> = {
  pinned: 'Закреплено', change: 'Изменить', pinAction: 'Закрепить', cancel: 'Отмена',
  title: 'Schach-Treff', more: 'Другие разделы', rooms: 'Комнаты', general: 'Общий чат', clubs: 'Мои клубы',
  tournaments: 'Турниры', soon: 'скоро', members: 'Участники', ranking: 'Рейтинг', about: 'О нас',
  rankingSoon: 'Таблица рейтинга появится вместе с системой Elo',
  tournamentTitle: 'Турниры скоро начнутся', tournamentText: 'Турниры по швейцарской системе и в формате арены прямо в Schach-Treff. Мы сообщим, когда откроется первый турнир.',
  notify: 'Уведомить меня', notified: 'Мы сообщим вам',
  aboutText: 'Schach-Treff — раздел ChessAZ для всех, кто хочет играть в шахматы и обсуждать их на немецком языке: участников клубов, турнирных игроков и любителей. Вежливо, по делу, без рекламы.',
  close: 'Закрыть', loading: 'Загрузка…', error: 'Не удалось загрузить или сохранить данные. Попробуйте ещё раз.',
  empty: 'Пока нет сообщений. Поделитесь ссылкой-приглашением со своим клубом.', placeholder: 'Написать сообщение…', send: 'Отправить',
  join: 'Вступить в сообщество', login: 'Войти', joinHint: 'Вступите в клуб, чтобы видеть сообщения.',
  noClub: 'Комната ещё не настроена.', noMembers: 'Участников пока нет.', blitz: 'Блиц', rapid: 'Рапид',
  noLocation: 'Город и клуб не указаны', yesterday: 'вчера',
  reviewLanguage: 'Deutsch', reviewLanguageLabel: 'Oberfläche auf Deutsch anzeigen',
  reviewLanguageHint: 'Zur deutschen Oberfläche zurückkehren',
};
