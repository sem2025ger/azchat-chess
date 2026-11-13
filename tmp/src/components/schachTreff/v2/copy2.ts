import { useOptionalLanguage } from '../../../context/LanguageContext';
import type { Language } from '../../../translations';

// Stage 2 strings: direct messages, chat settings, positions and finished games.
type Copy2 = {
  bullet: string;
  direct: string; directEmpty: string; writePrivately: string; directChat: string;
  settings: string; settingsTitle: string; whoCanWrite: string;
  policyAll: string; policyClubs: string; policyNone: string; hideGames: string; save: string; saved: string;
  block: string; unblock: string; blockedNote: string; composerBlocked: string;
  refusals: { blocked: string; dm_not_allowed: string; dm_limit: string };
  position: string; positionTitle: string; fenLabel: string; fromAnalysis: string;
  replyTitle: string; boardHint: string; replyNeedsChange: string; undoMove: string; resetPosition: string;
  invalidFen: string; noAnalysis: string; caption: string; captionPlaceholder: string; sendPosition: string;
  replyWithPosition: string; openInAnalysis: string; sideToMove: (white: boolean) => string;
  gamePlayed: string; watchGame: string; moves: (n: number) => string; viewer: string;
  first: string; previous: string; next: string; last: string; whiteWins: string; blackWins: string; draw: string; noMoves: string;
};

const slavic = (one: string, few: string, many: string) => (n: number) => {
  const a = n % 10, b = n % 100;
  return `${n} ${a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many}`;
};

export const v2Copy2: Record<Language, Copy2> = {
  de: {
    bullet: 'Bullet',
    direct: 'Direktnachrichten', directEmpty: 'Noch keine Gespräche. Tippe bei einem Mitglied auf „Privat schreiben“.',
    writePrivately: 'Privat schreiben', directChat: 'Nur ihr beide seht dieses Gespräch',
    settings: 'Chat-Einstellungen', settingsTitle: 'Deine Chat-Einstellungen', whoCanWrite: 'Wer darf mir schreiben?',
    policyAll: 'Alle', policyClubs: 'Nur Mitglieder meiner Vereinschats', policyNone: 'Niemand',
    hideGames: 'Meine Partien nicht im Chat zeigen', save: 'Speichern', saved: 'Gespeichert',
    block: 'Blockieren', unblock: 'Blockierung aufheben', composerBlocked: 'Chat blockiert', blockedNote: 'Du hast diesen Spieler blockiert. Ihr könnt euch keine Nachrichten mehr schreiben.',
    refusals: { blocked: 'Nachrichten zwischen euch sind blockiert.', dm_not_allowed: 'Dieser Spieler empfängt gerade keine Direktnachrichten.', dm_limit: 'Heute sind höchstens 20 neue Gespräche möglich.' },
    position: 'Stellung', positionTitle: 'Stellung im Chat teilen', fenLabel: 'Stellung (FEN)', fromAnalysis: 'Aus meiner Analyse',
    replyTitle: 'Antwort mit Stellung', boardHint: 'Zug ausführen: erst die Figur, dann das Zielfeld antippen.', replyNeedsChange: 'Mach einen Zug oder schreib einen Kommentar.', undoMove: 'Zug zurück', resetPosition: 'Zurücksetzen', invalidFen: 'Diese Stellung ist ungültig.', noAnalysis: 'In der Analyse ist noch keine Stellung geöffnet.',
    caption: 'Kommentar', captionPlaceholder: 'Zum Beispiel: Wie spielt ihr hier?', sendPosition: 'Stellung senden',
    replyWithPosition: 'Mit Stellung antworten', openInAnalysis: 'In der Analyse öffnen', sideToMove: white => white ? 'Weiß am Zug' : 'Schwarz am Zug',
    gamePlayed: 'Partie gespielt', watchGame: 'Partie ansehen', moves: n => `${n} ${n === 1 ? 'Zug' : 'Züge'}`, viewer: 'Partie',
    first: 'Zum Anfang', previous: 'Zurück', next: 'Weiter', last: 'Zum Ende', whiteWins: 'Weiß gewinnt', blackWins: 'Schwarz gewinnt', draw: 'Remis',
    noMoves: 'In dieser Partie wurde kein Zug gespielt.',
  },
  en: {
    bullet: 'Bullet',
    direct: 'Direct messages', directEmpty: 'No conversations yet. Tap “Message privately” next to a member.',
    writePrivately: 'Message privately', directChat: 'Only the two of you see this conversation',
    settings: 'Chat settings', settingsTitle: 'Your chat settings', whoCanWrite: 'Who can message me?',
    policyAll: 'Everyone', policyClubs: 'Only members of my club chats', policyNone: 'Nobody',
    hideGames: 'Do not show my games in the chat', save: 'Save', saved: 'Saved',
    block: 'Block', unblock: 'Unblock', composerBlocked: 'Chat blocked', blockedNote: 'You blocked this player. You can no longer message each other.',
    refusals: { blocked: 'Messages between you are blocked.', dm_not_allowed: 'This player does not accept direct messages right now.', dm_limit: 'You can start at most 20 new conversations per day.' },
    position: 'Position', positionTitle: 'Share a position in the chat', fenLabel: 'Position (FEN)', fromAnalysis: 'From my analysis',
    replyTitle: 'Reply with a position', boardHint: 'To move, tap a piece, then its target square.', replyNeedsChange: 'Make a move or add a comment.', undoMove: 'Undo move', resetPosition: 'Reset', invalidFen: 'This position is not valid.', noAnalysis: 'No position is open in the analysis yet.',
    caption: 'Comment', captionPlaceholder: 'For example: how would you play here?', sendPosition: 'Send position',
    replyWithPosition: 'Reply with a position', openInAnalysis: 'Open in analysis', sideToMove: white => white ? 'White to move' : 'Black to move',
    gamePlayed: 'game played', watchGame: 'Watch game', moves: n => `${n} ${n === 1 ? 'move' : 'moves'}`, viewer: 'Game',
    first: 'First move', previous: 'Back', next: 'Forward', last: 'Last move', whiteWins: 'White wins', blackWins: 'Black wins', draw: 'Draw',
    noMoves: 'No moves were played in this game.',
  },
  ru: {
    bullet: 'Пуля',
    direct: 'Личные сообщения', directEmpty: 'Пока нет разговоров. Нажмите «Написать лично» рядом с участником.',
    writePrivately: 'Написать лично', directChat: 'Этот разговор видите только вы двое',
    settings: 'Настройки чата', settingsTitle: 'Ваши настройки чата', whoCanWrite: 'Кто может мне писать?',
    policyAll: 'Все', policyClubs: 'Только участники моих клубных чатов', policyNone: 'Никто',
    hideGames: 'Не показывать мои партии в чате', save: 'Сохранить', saved: 'Сохранено',
    block: 'Заблокировать', unblock: 'Разблокировать', composerBlocked: 'Чат заблокирован', blockedNote: 'Вы заблокировали этого игрока. Писать друг другу больше нельзя.',
    refusals: { blocked: 'Сообщения между вами заблокированы.', dm_not_allowed: 'Этот игрок сейчас не принимает личные сообщения.', dm_limit: 'В день можно начать не больше 20 новых разговоров.' },
    position: 'Позиция', positionTitle: 'Отправить позицию в чат', fenLabel: 'Позиция (FEN)', fromAnalysis: 'Из моего Анализа',
    replyTitle: 'Ответ позицией', boardHint: 'Чтобы сделать ход, нажмите фигуру, затем поле.', replyNeedsChange: 'Сделайте ход или добавьте комментарий.', undoMove: 'Отменить ход', resetPosition: 'Сбросить', invalidFen: 'Эта позиция недопустима.', noAnalysis: 'В Анализе пока не открыта позиция.',
    caption: 'Комментарий', captionPlaceholder: 'Например: как вы здесь играете?', sendPosition: 'Отправить позицию',
    replyWithPosition: 'Ответить позицией', openInAnalysis: 'Открыть в анализе', sideToMove: white => white ? 'Ход белых' : 'Ход чёрных',
    gamePlayed: 'партия сыграна', watchGame: 'Смотреть партию', moves: slavic('ход', 'хода', 'ходов'), viewer: 'Партия',
    first: 'В начало', previous: 'Назад', next: 'Вперёд', last: 'В конец', whiteWins: 'Победа белых', blackWins: 'Победа чёрных', draw: 'Ничья',
    noMoves: 'В этой партии не было сделано ни одного хода.',
  },
  ua: {
    bullet: 'Куля',
    direct: 'Особисті повідомлення', directEmpty: 'Поки немає розмов. Натисніть «Написати особисто» біля учасника.',
    writePrivately: 'Написати особисто', directChat: 'Цю розмову бачите лише ви двоє',
    settings: 'Налаштування чату', settingsTitle: 'Ваші налаштування чату', whoCanWrite: 'Хто може мені писати?',
    policyAll: 'Усі', policyClubs: 'Лише учасники моїх клубних чатів', policyNone: 'Ніхто',
    hideGames: 'Не показувати мої партії в чаті', save: 'Зберегти', saved: 'Збережено',
    block: 'Заблокувати', unblock: 'Розблокувати', composerBlocked: 'Чат заблоковано', blockedNote: 'Ви заблокували цього гравця. Писати одне одному більше не можна.',
    refusals: { blocked: 'Повідомлення між вами заблоковано.', dm_not_allowed: 'Цей гравець зараз не приймає особисті повідомлення.', dm_limit: 'За день можна почати не більше 20 нових розмов.' },
    position: 'Позиція', positionTitle: 'Надіслати позицію в чат', fenLabel: 'Позиція (FEN)', fromAnalysis: 'З мого Аналізу',
    replyTitle: 'Відповідь позицією', boardHint: 'Щоб зробити хід, натисніть фігуру, потім поле.', replyNeedsChange: 'Зробіть хід або додайте коментар.', undoMove: 'Скасувати хід', resetPosition: 'Скинути', invalidFen: 'Ця позиція недопустима.', noAnalysis: 'В Аналізі ще не відкрита позиція.',
    caption: 'Коментар', captionPlaceholder: 'Наприклад: як ви тут граєте?', sendPosition: 'Надіслати позицію',
    replyWithPosition: 'Відповісти позицією', openInAnalysis: 'Відкрити в аналізі', sideToMove: white => white ? 'Хід білих' : 'Хід чорних',
    gamePlayed: 'партію зіграно', watchGame: 'Дивитися партію', moves: slavic('хід', 'ходи', 'ходів'), viewer: 'Партія',
    first: 'На початок', previous: 'Назад', next: 'Вперед', last: 'В кінець', whiteWins: 'Перемога білих', blackWins: 'Перемога чорних', draw: 'Нічия',
    noMoves: 'У цій партії не було зроблено жодного ходу.',
  },
  az: {
    bullet: 'Bullet',
    direct: 'Şəxsi mesajlar', directEmpty: 'Hələ söhbət yoxdur. Üzvün yanında «Şəxsi yaz» düyməsinə basın.',
    writePrivately: 'Şəxsi yaz', directChat: 'Bu söhbəti yalnız siz ikiniz görürsünüz',
    settings: 'Söhbət ayarları', settingsTitle: 'Söhbət ayarlarınız', whoCanWrite: 'Mənə kim yaza bilər?',
    policyAll: 'Hamı', policyClubs: 'Yalnız klub söhbətlərimin üzvləri', policyNone: 'Heç kim',
    hideGames: 'Partiyalarımı söhbətdə göstərmə', save: 'Yadda saxla', saved: 'Yadda saxlanıldı',
    block: 'Blokla', unblock: 'Blokdan çıxar', composerBlocked: 'Çat bloklanıb', blockedNote: 'Bu oyunçunu bloklamısınız. Bir-birinizə artıq yaza bilməzsiniz.',
    refusals: { blocked: 'Aranızda mesajlar bloklanıb.', dm_not_allowed: 'Bu oyunçu hazırda şəxsi mesaj qəbul etmir.', dm_limit: 'Gündə ən çox 20 yeni söhbət başlatmaq olar.' },
    position: 'Mövqe', positionTitle: 'Mövqeni söhbətə göndər', fenLabel: 'Mövqe (FEN)', fromAnalysis: 'Analizimdən',
    replyTitle: 'Mövqe ilə cavab', boardHint: 'Gediş üçün əvvəl fiqura, sonra xanaya toxunun.', replyNeedsChange: 'Gediş edin və ya şərh yazın.', undoMove: 'Gedişi geri al', resetPosition: 'Sıfırla', invalidFen: 'Bu mövqe yanlışdır.', noAnalysis: 'Analizdə hələ mövqe açılmayıb.',
    caption: 'Şərh', captionPlaceholder: 'Məsələn: burada necə oynayırsınız?', sendPosition: 'Mövqeni göndər',
    replyWithPosition: 'Mövqe ilə cavab ver', openInAnalysis: 'Analizdə aç', sideToMove: white => white ? 'Ağların gedişi' : 'Qaraların gedişi',
    gamePlayed: 'partiya oynanıldı', watchGame: 'Partiyaya bax', moves: n => `${n} gediş`, viewer: 'Partiya',
    first: 'Əvvələ', previous: 'Geri', next: 'İrəli', last: 'Sona', whiteWins: 'Ağlar qalib', blackWins: 'Qaralar qalib', draw: 'Heç-heçə',
    noMoves: 'Bu partiyada heç bir gediş edilməyib.',
  },
  tr: {
    bullet: 'Bullet',
    direct: 'Özel mesajlar', directEmpty: 'Henüz sohbet yok. Bir üyenin yanında «Özel yaz» düğmesine dokunun.',
    writePrivately: 'Özel yaz', directChat: 'Bu sohbeti yalnızca ikiniz görüyorsunuz',
    settings: 'Sohbet ayarları', settingsTitle: 'Sohbet ayarlarınız', whoCanWrite: 'Bana kim yazabilir?',
    policyAll: 'Herkes', policyClubs: 'Yalnızca kulüp sohbetlerimin üyeleri', policyNone: 'Hiç kimse',
    hideGames: 'Oyunlarımı sohbette gösterme', save: 'Kaydet', saved: 'Kaydedildi',
    block: 'Engelle', unblock: 'Engeli kaldır', composerBlocked: 'Sohbet engellendi', blockedNote: 'Bu oyuncuyu engellediniz. Artık birbirinize yazamazsınız.',
    refusals: { blocked: 'Aranızdaki mesajlar engellendi.', dm_not_allowed: 'Bu oyuncu şu anda özel mesaj kabul etmiyor.', dm_limit: 'Günde en fazla 20 yeni sohbet başlatabilirsiniz.' },
    position: 'Pozisyon', positionTitle: 'Pozisyonu sohbette paylaş', fenLabel: 'Pozisyon (FEN)', fromAnalysis: 'Analizimden',
    replyTitle: 'Pozisyonla yanıt', boardHint: 'Hamle için önce taşa, sonra hedef kareye dokunun.', replyNeedsChange: 'Bir hamle yapın veya yorum ekleyin.', undoMove: 'Hamleyi geri al', resetPosition: 'Sıfırla', invalidFen: 'Bu pozisyon geçersiz.', noAnalysis: 'Analizde henüz açık pozisyon yok.',
    caption: 'Yorum', captionPlaceholder: 'Örneğin: burada nasıl oynarsınız?', sendPosition: 'Pozisyonu gönder',
    replyWithPosition: 'Pozisyonla yanıtla', openInAnalysis: 'Analizde aç', sideToMove: white => white ? 'Hamle beyazda' : 'Hamle siyahta',
    gamePlayed: 'oyun oynandı', watchGame: 'Oyunu izle', moves: n => `${n} hamle`, viewer: 'Oyun',
    first: 'Başa', previous: 'Geri', next: 'İleri', last: 'Sona', whiteWins: 'Beyaz kazandı', blackWins: 'Siyah kazandı', draw: 'Berabere',
    noMoves: 'Bu oyunda hiç hamle yapılmadı.',
  },
};

export function useV2Copy2(): Copy2 {
  const language = useOptionalLanguage()?.language || 'de';
  return v2Copy2[language as Language] ?? v2Copy2.de;
}
