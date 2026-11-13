import { useOptionalLanguage } from '../../../context/LanguageContext';
import type { Language } from '../../../translations';

type Copy = {
  seek: string; seekHint: string; seekLimit: string; blitz: string; rapid: string;
  members: string; activeNow: string; challenge: string;
  reply: string; thread: string; noReplies: string; replyPlaceholder: string; closeThread: string; send: string;
  reactionNames: Record<'!!' | '!' | '!?', string>; reactions: string;
  feedbackButton: string; feedbackTitle: string; feedbackPlaceholder: string; feedbackThanks: string;
  feedbackLimit: string; feedbackShort: string; feedbackLogin: string;
  replies: (count: number) => string;
};

const slavic = (one: string, few: string, many: string) => (n: number) => {
  const a = n % 10, b = n % 100;
  const word = a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many;
  return `${n} ${word}`;
};

export const v2Copy: Record<Language, Copy> = {
  de: {
    seek: 'Gegner suchen', seekHint: 'Bedenkzeit wählen – die Karte erscheint sofort im Chat.',
    seekLimit: 'Du hast bereits drei offene Herausforderungen.', blitz: 'Blitz', rapid: 'Schnellschach',
    members: 'Mitglieder', activeNow: 'gerade aktiv', challenge: 'Herausfordern',
    reply: 'Im Thread antworten', thread: 'Thread', noReplies: 'Noch keine Antworten',
    replyPlaceholder: 'Antworten …', closeThread: 'Thread schließen', send: 'Senden',
    reactionNames: { '!!': 'Brillant', '!': 'Guter Zug', '!?': 'Interessant' }, reactions: 'Reaktionen',
    feedbackButton: 'Feedback: Ideen und Probleme',
    feedbackTitle: 'Was können wir verbessern? Schreib uns eine Idee oder ein Problem – das sieht nur das ChessAZ-Team.',
    feedbackPlaceholder: 'Zum Beispiel: Das Brett ist auf dem Handy zu klein',
    feedbackThanks: 'Danke! Deine Nachricht ist beim ChessAZ-Team angekommen.',
    feedbackLimit: 'Heute sind höchstens zehn Nachrichten möglich.', feedbackShort: 'Bitte schreib mindestens drei Zeichen.',
    feedbackLogin: 'Bitte melde dich an, um uns zu schreiben.',
    replies: n => `${n} ${n === 1 ? 'Antwort' : 'Antworten'}`,
  },
  en: {
    seek: 'Find opponent', seekHint: 'Choose a time control – the card appears in the chat right away.',
    seekLimit: 'You already have three open challenges.', blitz: 'Blitz', rapid: 'Rapid',
    members: 'Members', activeNow: 'active now', challenge: 'Challenge',
    reply: 'Reply in thread', thread: 'Thread', noReplies: 'No replies yet',
    replyPlaceholder: 'Reply …', closeThread: 'Close thread', send: 'Send',
    reactionNames: { '!!': 'Brilliant', '!': 'Good move', '!?': 'Interesting' }, reactions: 'Reactions',
    feedbackButton: 'Feedback: ideas and problems',
    feedbackTitle: 'What can we improve? Write an idea or a problem – only the ChessAZ team sees it.',
    feedbackPlaceholder: 'For example: the board is too small on my phone',
    feedbackThanks: 'Thank you! The ChessAZ team has received your message.',
    feedbackLimit: 'You can send at most ten messages per day.', feedbackShort: 'Please write at least three characters.',
    feedbackLogin: 'Please sign in to send feedback.',
    replies: n => `${n} ${n === 1 ? 'reply' : 'replies'}`,
  },
  ru: {
    seek: 'Ищу соперника', seekHint: 'Выберите контроль — карточка сразу появится в чате.',
    seekLimit: 'У вас уже три открытых вызова.', blitz: 'Блиц', rapid: 'Рапид',
    members: 'Участники', activeNow: 'сейчас активен', challenge: 'Вызвать',
    reply: 'Ответить в ветке', thread: 'Ветка', noReplies: 'Пока нет ответов',
    replyPlaceholder: 'Ваш ответ…', closeThread: 'Закрыть ветку', send: 'Отправить',
    reactionNames: { '!!': 'Блестяще', '!': 'Хороший ход', '!?': 'Интересно' }, reactions: 'Реакции',
    feedbackButton: 'Ваше мнение: идеи и проблемы',
    feedbackTitle: 'Что можно улучшить? Напишите идею или проблему — это видит только команда ChessAZ.',
    feedbackPlaceholder: 'Например: доска на телефоне слишком маленькая',
    feedbackThanks: 'Спасибо! Сообщение получила команда ChessAZ.',
    feedbackLimit: 'В день можно отправить не больше десяти сообщений.', feedbackShort: 'Напишите хотя бы три символа.',
    feedbackLogin: 'Войдите, чтобы написать нам.',
    replies: slavic('ответ', 'ответа', 'ответов'),
  },
  ua: {
    seek: 'Шукаю суперника', seekHint: 'Оберіть контроль — картка одразу з’явиться в чаті.',
    seekLimit: 'У вас уже три відкриті виклики.', blitz: 'Бліц', rapid: 'Рапід',
    members: 'Учасники', activeNow: 'зараз активний', challenge: 'Викликати',
    reply: 'Відповісти в гілці', thread: 'Гілка', noReplies: 'Поки немає відповідей',
    replyPlaceholder: 'Ваша відповідь…', closeThread: 'Закрити гілку', send: 'Надіслати',
    reactionNames: { '!!': 'Блискуче', '!': 'Добрий хід', '!?': 'Цікаво' }, reactions: 'Реакції',
    feedbackButton: 'Ваша думка: ідеї та проблеми',
    feedbackTitle: 'Що можна покращити? Напишіть ідею або проблему — це бачить лише команда ChessAZ.',
    feedbackPlaceholder: 'Наприклад: дошка на телефоні замала',
    feedbackThanks: 'Дякуємо! Повідомлення отримала команда ChessAZ.',
    feedbackLimit: 'За день можна надіслати не більше десяти повідомлень.', feedbackShort: 'Напишіть щонайменше три символи.',
    feedbackLogin: 'Увійдіть, щоб написати нам.',
    replies: slavic('відповідь', 'відповіді', 'відповідей'),
  },
  az: {
    seek: 'Rəqib axtarıram', seekHint: 'Vaxt nəzarətini seçin — kart dərhal söhbətdə görünəcək.',
    seekLimit: 'Artıq üç açıq çağırışınız var.', blitz: 'Blits', rapid: 'Rapid',
    members: 'Üzvlər', activeNow: 'indi aktivdir', challenge: 'Çağır',
    reply: 'Mövzuda cavab ver', thread: 'Mövzu', noReplies: 'Hələ cavab yoxdur',
    replyPlaceholder: 'Cavab yaz…', closeThread: 'Mövzunu bağla', send: 'Göndər',
    reactionNames: { '!!': 'Parlaq', '!': 'Yaxşı gediş', '!?': 'Maraqlı' }, reactions: 'Reaksiyalar',
    feedbackButton: 'Rəyiniz: ideyalar və problemlər',
    feedbackTitle: 'Nəyi yaxşılaşdıra bilərik? İdeya və ya problem yazın — bunu yalnız ChessAZ komandası görür.',
    feedbackPlaceholder: 'Məsələn: telefonda taxta çox kiçikdir',
    feedbackThanks: 'Təşəkkürlər! Mesajınız ChessAZ komandasına çatdı.',
    feedbackLimit: 'Gündə ən çox on mesaj göndərmək olar.', feedbackShort: 'Ən azı üç simvol yazın.',
    feedbackLogin: 'Bizə yazmaq üçün daxil olun.',
    replies: n => `${n} cavab`,
  },
  tr: {
    seek: 'Rakip arıyorum', seekHint: 'Süreyi seçin — kart hemen sohbette görünür.',
    seekLimit: 'Zaten üç açık meydan okumanız var.', blitz: 'Blitz', rapid: 'Hızlı',
    members: 'Üyeler', activeNow: 'şu an aktif', challenge: 'Meydan oku',
    reply: 'Konuda yanıtla', thread: 'Konu', noReplies: 'Henüz yanıt yok',
    replyPlaceholder: 'Yanıt yaz…', closeThread: 'Konuyu kapat', send: 'Gönder',
    reactionNames: { '!!': 'Parlak', '!': 'İyi hamle', '!?': 'İlginç' }, reactions: 'Tepkiler',
    feedbackButton: 'Görüşünüz: fikirler ve sorunlar',
    feedbackTitle: 'Neyi iyileştirebiliriz? Bir fikir veya sorun yazın — bunu yalnızca ChessAZ ekibi görür.',
    feedbackPlaceholder: 'Örneğin: telefonda tahta çok küçük',
    feedbackThanks: 'Teşekkürler! Mesajınız ChessAZ ekibine ulaştı.',
    feedbackLimit: 'Günde en fazla on mesaj gönderebilirsiniz.', feedbackShort: 'Lütfen en az üç karakter yazın.',
    feedbackLogin: 'Bize yazmak için giriş yapın.',
    replies: n => `${n} yanıt`,
  },
};

export function useV2Copy(): Copy {
  const language = useOptionalLanguage()?.language || 'de';
  return v2Copy[language as Language] ?? v2Copy.de;
}
