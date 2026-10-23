import type { Language } from '../../translations';

const en = {
  flip: 'Flip board', deeper: 'Analyze deeper', map: 'Map', editor: 'Editor', more: 'More actions', lines: 'Engine lines',
  expand: 'Expand', collapse: 'Collapse', copied: 'Copied', copyFailed: 'Could not copy. Please try again.',
  pgn: 'Copy PGN with evaluations', fen: 'Copy FEN', share: 'Share position', close: 'Close',
  missingKings: 'Add one white king and one black king to analyze the position.',
};
export const mobileAnalysisCopy: Record<Language, typeof en> = {
  en,
  ru: { flip:'Перевернуть доску', deeper:'Анализировать глубже', map:'Карта', editor:'Редактор', more:'Действия с анализом', lines:'Варианты движка', expand:'Развернуть', collapse:'Свернуть', copied:'Скопировано', copyFailed:'Не удалось скопировать. Попробуйте ещё раз.', pgn:'Копировать PGN с оценками', fen:'Копировать FEN', share:'Поделиться позицией', close:'Закрыть', missingKings:'Для анализа добавьте по одному белому и чёрному королю.' },
  de: { flip:'Brett drehen', deeper:'Tiefer analysieren', map:'Karte', editor:'Editor', more:'Weitere Aktionen', lines:'Engine-Varianten', expand:'Aufklappen', collapse:'Zuklappen', copied:'Kopiert', copyFailed:'Kopieren fehlgeschlagen. Bitte erneut versuchen.', pgn:'PGN mit Bewertungen kopieren', fen:'FEN kopieren', share:'Stellung teilen', close:'Schließen', missingKings:'Füge zum Analysieren je einen weißen und schwarzen König hinzu.' },
  az: { flip:'Taxtanı çevir', deeper:'Daha dərindən təhlil et', map:'Xəritə', editor:'Redaktor', more:'Təhlil əməliyyatları', lines:'Mühərrik variantları', expand:'Genişləndir', collapse:'Yığ', copied:'Kopyalandı', copyFailed:'Kopyalamaq alınmadı. Yenidən cəhd edin.', pgn:'Qiymətlərlə PGN-i kopyala', fen:'FEN-i kopyala', share:'Mövqeni paylaş', close:'Bağla', missingKings:'Təhlil üçün bir ağ və bir qara şah əlavə edin.' },
  tr: { flip:'Tahtayı çevir', deeper:'Daha derin analiz et', map:'Harita', editor:'Düzenle', more:'Diğer işlemler', lines:'Motor varyantları', expand:'Genişlet', collapse:'Daralt', copied:'Kopyalandı', copyFailed:'Kopyalanamadı. Tekrar deneyin.', pgn:'Değerlendirmelerle PGN kopyala', fen:'FEN kopyala', share:'Konumu paylaş', close:'Kapat', missingKings:'Analiz için bir beyaz ve bir siyah şah ekleyin.' },
  ua: { flip:'Перевернути дошку', deeper:'Аналізувати глибше', map:'Карта', editor:'Редактор', more:'Дії з аналізом', lines:'Варіанти рушія', expand:'Розгорнути', collapse:'Згорнути', copied:'Скопійовано', copyFailed:'Не вдалося скопіювати. Спробуйте ще раз.', pgn:'Копіювати PGN з оцінками', fen:'Копіювати FEN', share:'Поділитися позицією', close:'Закрити', missingKings:'Для аналізу додайте по одному білому та чорному королю.' },
};
