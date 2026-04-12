// AI Chat Assistant Mock Logic
// This provides rules for translations, rewriting, toxicity, and chess term explanations.

export interface ChatTerm {
  term: string;
  explanation: string;
}

export interface QuickPhrase {
  bg: string;
  text: string;
}

const CHESS_TERMS: Record<string, ChatTerm> = {
  gambit: { term: "Gambit", explanation: "An opening move where a player sacrifices a piece (usually a pawn) to gain a strategic advantage (space, development)." },
  zugzwang: { term: "Zugzwang", explanation: "A situation where a player is forced to make a move that significantly weakens their position." },
  initiative: { term: "Initiative", explanation: "The ability to create threats and force the opponent to respond, maintaining control over the flow of the game." },
  tempo: { term: "Tempo", explanation: "A single move or time unit in chess. Gaining a tempo means developing a piece while forcing an opponent to waste a move." },
  development: { term: "Development", explanation: "The process of moving pieces from their starting squares to more active and influential ones." },
  positional: { term: "Positional Mistake", explanation: "A long-term strategic error that weakens a square, pawn structure, or piece coordination without immediate tactical loss." },
  tactical: { term: "Tactical Mistake", explanation: "A short-term calculation error that leads to an immediate loss of material or a checkmate threat." },
};

const QUICK_PHRASES = [
  "Good game!",
  "Thanks for the game.",
  "Want a rematch?",
  "Nice opening!",
  "Who wants to play 5+3?",
  "Looking for a friendly match.",
  "Interesting position here.",
  "Good luck!",
];

const QUICK_REPLIES = [
  "Yes, let's do it.",
  "Maybe later, thanks.",
  "I am new to this opening.",
  "Great move! I didn't see that.",
  "GG!",
  "WP!",
];

export function getChessTerms(): ChatTerm[] {
  return Object.values(CHESS_TERMS);
}

export function getQuickPhrases(): string[] {
  return QUICK_PHRASES;
}

export function getQuickReplies(): string[] {
  return QUICK_REPLIES;
}

export function rewriteMessage(text: string, tone: 'polite' | 'friendly' | 'neutral'): string {
  if (!text) return "";
  
  const rules = {
    polite: "I would like to kindly suggest: ",
    friendly: "Hey! How about: ",
    neutral: "Message draft: ",
  };

  // Simple mock transformation
  return `${rules[tone]}${text.charAt(0).toUpperCase() + text.slice(1)}`;
}

export function translateMock(text: string, targetLang: 'az' | 'tr' | 'ru'): string {
  if (!text) return "";
  
  const prefixes = {
    az: "[AZ Tərcümə]: ",
    tr: "[TR Çeviri]: ",
    ru: "[RU Перевод]: ",
  };

  return `${prefixes[targetLang]}${text}`;
}

export function checkToxicity(text: string): { isToxic: boolean, suggestion?: string } {
  const toxicKeywords = ["bad", "noob", "easy", "stupid", "idiot", "hate"];
  const lowerText = text.toLowerCase();
  
  const found = toxicKeywords.some(word => lowerText.includes(word));
  if (found) {
    return {
      isToxic: true,
      suggestion: "Let's keep it friendly. Maybe try: 'Good luck with your next game!'"
    };
  }
  
  return { isToxic: false };
}
