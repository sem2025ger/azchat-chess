import { useOptionalLanguage } from '../../context/LanguageContext';
import { translateSchachTreff } from './i18n';
export const copy = {
  deleted: "Nachricht gelöscht",
  messageActions: "Nachrichtenaktionen",
  moderation: "Chat-Aktionen",
  deleteMessage: "Nachricht löschen",
  confirmDelete: "Diese Nachricht dauerhaft aus dem Chat entfernen?",
  reportMessage: "Nachricht melden",
  reportReason: "Grund der Meldung",
  reportSpam: "Spam",
  reportAbuse: "Beleidigung oder Belästigung",
  reportOther: "Sonstiges",
  reports: "Meldungen",
  noReports: "Keine offenen Meldungen.",
  restoreMessage: "Nachricht wiederherstellen",
  hiddenMessage: "Für Mitglieder ausgeblendet",
  clearChat: "Chat leeren",
  confirmClear: "Alle bisherigen Nachrichten in diesem Vereinschat dauerhaft entfernen?",
  revokeInvites: "Alle Einladungslinks widerrufen",
  confirmRevoke: "Alle aktiven Einladungslinks dieses Vereins ungültig machen?",
  unreadMessages: "Ungelesene Nachrichten",
  reported: "Meldung gesendet.",
  invitesRevoked: "Einladungslinks widerrufen.",
  challengeDeleteBlocked: "Nachrichten mit einer Herausforderung können nicht einzeln gelöscht werden.",
  alreadyReported: "Du hast diese Nachricht bereits gemeldet.",
  reportLimit: "Das Tageslimit von 20 Meldungen ist erreicht.",
  invite: 'Einladen', editPin: 'Angeheftete Nachricht bearbeiten', challengePlayer: 'Spieler herausfordern',
  showMore: 'Mehr anzeigen', showLess: 'Weniger anzeigen', shortPlaceholder: 'Nachricht',
  createClub: '+ Vereinschat erstellen', clubEmpty: 'Geschlossener Chat nur für Mitglieder deines Vereins. Erstelle einen Vereinschat oder nimm eine Einladung an.', backGeneral: '← Allgemeiner Chat', clubName: 'Name des Vereins', createRoom: 'Raum erstellen',
  copyLink: 'Link kopieren', linkCopied: 'Link kopiert', inviteLink: 'Einladungslink', inviteReady: 'Dein Einladungslink ist bereit.',
  roomErrors: { invite_limit: 'Dieser Raum hat bereits zehn aktive Links. Verwende einen bereits versendeten Link; neue sind nach Ablauf der alten möglich.', not_allowed: 'Diese Aktion ist nicht erlaubt.', invalid_room_name: 'Der Name muss 3–60 Zeichen lang sein.',
    room_limit: 'Du kannst höchstens zwei Vereinsräume erstellen.', invite_invalid: 'Dieser Einladungslink ist ungültig.',
    invite_expired: 'Dieser Einladungslink ist abgelaufen.', invite_used: 'Dieser Einladungslink wurde bereits vollständig verwendet.' },
  challenge: 'Herausforderung', challengeAction: 'Herausfordern', challengeKind: 'Art der Herausforderung',
  openChallenge: 'Offen für alle', personalChallenge: 'Persönliche Herausforderung', openOffer: 'Offene Herausforderung',
  targetPlayer: 'Bestimmter Spieler', choosePlayer: 'Spieler auswählen', timeControl: 'Bedenkzeit',
  sendChallenge: 'Herausforderung senden', game: 'Partie', accept: 'Annehmen', expired: 'Abgelaufen', cancelled: 'Abgebrochen',
  waitingOpponent: 'Wartet auf Gegner', gameStarting: 'Partie startet …', gameStarted: 'Partie gestartet', openGame: 'Zur Partie',
  games: 'Partien', lastGames: 'Letzte Partien', noGames: 'Noch keine abgeschlossenen Partien.',
  challengeErrors: {
    not_allowed: 'Diese Aktion ist nicht erlaubt.', not_member: 'Beide Spieler müssen Mitglieder des Raums sein.',
    expired: 'Die Herausforderung ist abgelaufen.', already_taken: 'Diese Herausforderung ist nicht mehr verfügbar.',
    challenge_limit: 'Du kannst höchstens drei offene Herausforderungen haben.', invalid_time_control: 'Diese Bedenkzeit ist nicht verfügbar.',
    creator_offline: 'Der Herausforderer ist nicht mehr online.', player_unavailable: 'Ein Spieler ist gerade nicht verfügbar.',
    rate_limit_exceeded: 'Bitte warte kurz und versuche es erneut.', storage_unavailable: 'Die Partie kann gerade nicht sicher gestartet werden.',
  },
  pinned: 'Angeheftet', change: 'Ändern', pinAction: 'Anheften', cancel: 'Abbrechen',
  title: 'Schach-Treff', more: 'Weitere Bereiche', rooms: 'Räume', general: 'Allgemeiner Chat', clubs: 'Vereinschats',
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
} as const;


type LocalizedCopy = { [K in keyof typeof copy]: typeof copy[K] extends string ? string : { [N in keyof typeof copy[K]]: string } };
export function useSchachTreffCopy(): LocalizedCopy {
 const language=useOptionalLanguage()?.language || 'de';
 return Object.fromEntries(Object.entries(copy).map(([key,entry])=>[
  key,typeof entry==='string'?translateSchachTreff(language,entry):Object.fromEntries(Object.entries(entry).map(([subKey,value])=>[subKey,translateSchachTreff(language,value)])),
 ])) as LocalizedCopy;
}
