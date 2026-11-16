const en={stockfishContinuation:'Stockfish continuation',
 name:'Chessy',subtitle:'Your chess companion',idle:'Ready to explore this position.',ready:'Ask a follow-up or study a verified line.',thinking:'Working on your question…',listening:'Listening to your question…',speaking:'Reading the explanation aloud…',planQuestion:'Assess the position and suggest a plan',forWhite:'For White',forBlack:'For Black',
  planRequest:{white:'Assess the position and suggest a plan for White.',black:'Assess the position and suggest a plan for Black.'}
};
type Copy={stockfishContinuation:string;name:string;subtitle:string;idle:string;ready:string;thinking:string;listening:string;speaking:string;planQuestion:string;forWhite:string;forBlack:string;planRequest:Record<'white'|'black',string>};
export const chessyCopy={
 en,
 de:{stockfishContinuation:'Fortsetzung von Stockfish',name:'Chessy',subtitle:'Dein Schachbegleiter',idle:'Bereit, diese Stellung zu besprechen.',ready:'Frag nach oder prüfe eine bestätigte Variante.',thinking:'Ich prüfe deine Frage…',listening:'Ich höre deine Frage…',speaking:'Ich lese die Erklärung vor…',planQuestion:'Bewerte die Stellung und schlage einen Spielplan vor',forWhite:'Für Weiß',forBlack:'Für Schwarz',
  planRequest:{white:'Bewerte die Stellung und schlage einen Spielplan für Weiß vor.',black:'Bewerte die Stellung und schlage einen Spielplan für Schwarz vor.'}},
 ru:{stockfishContinuation:'продолжение Stockfish',name:'Chessy',subtitle:'Твой шахматный помощник',idle:'Готов обсудить эту позицию.',ready:'Задай следующий вопрос или изучи проверенный вариант.',thinking:'Разбираю твой вопрос…',listening:'Слушаю твой вопрос…',speaking:'Озвучиваю объяснение…',planQuestion:'Оцени позицию и предложи план игры',forWhite:'За белых',forBlack:'За чёрных',
  planRequest:{white:'Оцени позицию и предложи план игры за белых.',black:'Оцени позицию и предложи план игры за чёрных.'}},
 az:{stockfishContinuation:'Stockfish davamı',name:'Chessy',subtitle:'Şahmat köməkçin',idle:'Bu mövqeni müzakirə etməyə hazıram.',ready:'Növbəti sualı ver və ya yoxlanılmış variantı araşdır.',thinking:'Sualını təhlil edirəm…',listening:'Sualını dinləyirəm…',speaking:'İzahı səsləndirirəm…',planQuestion:'Mövqeni qiymətləndir və oyun planı təklif et',forWhite:'Ağlar üçün',forBlack:'Qaralar üçün',
  planRequest:{white:'Mövqeni qiymətləndir və ağlar üçün oyun planı təklif et.',black:'Mövqeni qiymətləndir və qaralar üçün oyun planı təklif et.'}},
 tr:{stockfishContinuation:'Stockfish devamı',name:'Chessy',subtitle:'Satranç yardımcın',idle:'Bu konumu konuşmaya hazırım.',ready:'Başka soru sor veya doğrulanmış varyantı incele.',thinking:'Sorunu inceliyorum…',listening:'Sorunu dinliyorum…',speaking:'Açıklamayı seslendiriyorum…',planQuestion:'Konumu değerlendir ve bir oyun planı öner',forWhite:'Beyaz için',forBlack:'Siyah için',
  planRequest:{white:'Konumu değerlendir ve Beyaz için bir oyun planı öner.',black:'Konumu değerlendir ve Siyah için bir oyun planı öner.'}},
 uk:{stockfishContinuation:'продовження Stockfish',name:'Chessy',subtitle:'Твій шаховий помічник',idle:'Готовий обговорити цю позицію.',ready:'Постав наступне запитання або переглянь перевірений варіант.',thinking:'Аналізую твоє запитання…',listening:'Слухаю твоє запитання…',speaking:'Озвучую пояснення…',planQuestion:'Оціни позицію і запропонуй план гри',forWhite:'За білих',forBlack:'За чорних',
  planRequest:{white:'Оціни позицію і запропонуй план гри за білих.',black:'Оціни позицію і запропонуй план гри за чорних.'}}
} satisfies Record<'en'|'de'|'ru'|'az'|'tr'|'uk',Copy>;
