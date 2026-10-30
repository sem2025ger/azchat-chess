# ChessAZ AI Coach — OpenAI: текст и голос, QA 30.10.2026

Статус: реализация подготовлена для review; живое подключение OpenAI и hosted QA не подтверждены. Ответы провайдера подменяются только внутри изолированных автоматических тестов. В продукте нет тестового AI-провайдера или выдуманных ответов.

## Исходная версия и границы

- Основа: Draft PR #153, `feat/ai-coach-context-chat-qa-20261030`, SHA `576398a197cdd848579b8d9cdaa3a01b121d8cf8`. В GitHub оба check — frontend и isolated PostgreSQL server — success.
- Рабочая ветка: `feat/ai-coach-openai-voice-qa-20261030`, отдельный Draft PR поверх #153.
- Для исходного SHA Vercel не вернул deployment ни в `azchat-chess`, ни в `chessaz-preview-workspace`. Прежние READY deployments относятся к другим SHA.
- Production, Supabase, настройки сервисов, hosted environment variables, аккаунты, ключи и исходный PR #153 не менялись. Render не использовался. OpenAI Developers не устанавливался.
- В доступной среде отсутствуют `OPENAI_API_KEY` и `QA_ACCESS_TOKEN`. Значения секретов не читались, ключи других проектов не использовались. Наличие ключа на hosted QA неизвестно.

## Что изменено

- `server/aiCoachOpenAI.js`: серверный Responses API с `gpt-6-sol`, `store:false`, строгим JSON-ответом; распознавание ограниченной записи через `gpt-transcribe`; озвучивание через современный Realtime API / `gpt-realtime-2.1-mini`, PCM 24 kHz → WAV. Устаревающий `/audio/speech` не добавлялся.
- `server/aiCoach.js`: авторизованные `/chat`, `/transcribe`, `/speech`; общий лимит 18 операций/минуту и 6 на каждый маршрут для одного аккаунта; одна активная операция на аккаунт и максимум 32 в процессе. Отмена при разрыве HTTP, таймауты, ограничения тела и безопасные коды ошибок.
- `server/aiCoachChat.js`: только OpenAI для нового чата. Существующий Gemini в `/preparation` сохранён. История ограничена 8 сообщениями, 1200 символами на сообщение; FEN и легальные ходы вычисляет chess.js. Примеры PGN проверяются относительно точного indexed ply. При недоступном архиве OpenAI получает явное отсутствие доказательств; число найденных партий не выдумывается. Без ключа допускается только явно помеченный прежний архивный ответ, если архив доступен.
- `CoachChat.tsx` / `.css`: реальная запись MediaRecorder до 30 секунд / 2 MiB, разрешение микрофона, распознавание в редактируемое поле, история, повторная отправка после ошибки, кнопка прослушивания и опция автоматической озвучки. Пользователь подтверждает распознанный вопрос кнопкой отправки. Плеер остаётся доступен при блокировке autoplay. Микрофон, запросы и blob URL освобождаются при закрытии, смене позиции, языка или пользователя. Защита от двойного нажатия и позднего разрешения микрофона.
- `coachChatCopy.ts`: использован существующий подход словарей проекта, DE/EN/AZ/TR/UK/RU с сохранением legacy `ua`. Новый чат скрыт при выключенном `VITE_AI_COACH_ENABLED`; значения флагов по умолчанию не включались.
- `ws@8.21.0` объявлен прямой server dependency: нужен серверный WebSocket с Authorization header. Эта версия уже присутствовала в lockfile как транзитивная зависимость. Остальные версии не менялись.
- CI устанавливает server dependencies в frontend job, поскольку новый browser regression проверяет настоящий Express router и WebSocket adapter. Проверки и требования CI не ослаблялись.

## Проверки, выполненные локально

- `npx tsc -b`: PASS из `tmp/`.
- `npm run build`: PASS; прежние предупреждения CSS selector / размера bundle сохранены.
- `npm run lint`: PASS, 0 ошибок, 62 предупреждения; изменённые TS/TSX файлы отдельно проходят без предупреждений.
- `node --test aiCoachOpenAI.test.js aiCoachChat.test.js aiCoach.test.js openingPrepQa.test.js`: 36 PASS, 0 failed/skipped.
- Полный server `npm test`: 231 PASS из 245, 0 failed, 14 skipped. Локальные PostgreSQL-тесты требуют отсутствующей здесь isolated database; успешный локальный прогон без БД не считается проверкой миграций/RLS.
- Полный frontend `npm test`: 182/183 PASS, 1 failed, 0 skipped. Единственный сбой — D-Bus wrapper существующего `globalPositions.test.mjs`: `Failed to open socket: Operation not permitted`. Проверка не отключалась и не изменялась. Неизменённый `node tests/globalPositions.browser.mjs` отдельно PASS.
- Новый `node tests/coachChat.browser.mjs`: PASS в настоящем Chromium. Цепочка browser → реальный Express router → адаптер OpenAI с тестовым провайдером → настоящий loopback WebSocket → WAV, который загружает HTML audio. Настоящий MediaRecorder использует тестовое устройство Chromium. Проверены шесть языков, 390/1280 px, история, доступ, ошибки, denied/late permissions, быстрые двойные клики, остановка при закрытии и отмена устаревшего ответа при смене FEN.
- `node tests/mobileAnalysis.browser.mjs`: PASS, включая настоящий Stockfish 19 WASM и мобильную/desktop доску.
- `node tests/spieltag.browser.mjs`: PASS. Существующий opening-preparation browser test с темами также входит в полный frontend-набор.
- Аудит server production dependencies: 0 vulnerabilities. Frontend audit уровня high проходит, но остаются 2 moderate vulnerabilities в существующем React Router. Breaking upgrade вне этого milestone не выполнялся.
- `git diff --check`: PASS. Сгенерированные Stockfish JS/WASM не входят в коммит.

Ограничения проверки: тестовые ответы и loopback WebSocket доказывают связность нашего кода, но не доступ к моделям, качество ответа OpenAI, произношение или работу реального микрофона пользователя. Настоящие OpenAI API calls не выполнялись. Визуальное покрытие не означает проверку контраста всех сочетаний тем.

## Точная оставшаяся конфигурация — только оператором в изолированном QA

Ничего из следующего в hosted окружении не менялось.

| Где | Что проверить или предоставить |
|---|---|
| QA backend | Exact reviewed SHA этого PR; подтверждённая QA Supabase binding, отдельная от production. Сохранить существующую проверку Supabase access token. |
| QA backend secrets | Собственный, уже безопасно предоставленный ChessAZ `OPENAI_API_KEY`. Не переносить ключ Sandbox/Jarvis и не передавать секрет в чат, Git, PR или browser bundle. |
| QA backend config | `OPENAI_COACH_MODEL=gpt-6-sol` (это и default); существующий `AI_COACH_ENABLED=true` только в согласованном QA. |
| OpenAI project access | Responses для `gpt-6-sol`, audio transcription для `gpt-transcribe`, Realtime для `gpt-realtime-2.1-mini`; доступный billing/usage budget. Текущий доступ аккаунта не проверен. |
| QA frontend | Exact reviewed SHA; `VITE_SERVER_URL` указывает на этот QA backend; QA-only Supabase URL/anon binding. Использовать существующие флаги Spieler/position search и `VITE_AI_COACH_ENABLED=true` только в согласованном QA. |
| HTTPS и origin | HTTPS для MediaRecorder/getUserMedia; QA frontend origin уже разрешён существующим backend CORS. Не менять production CORS ради проверки. |
| QA auth | Короткоживущая сессия отдельного QA-пользователя через защищённый runner. Никаких заимствованных личных сессий. |

## Оставшиеся живые тесты после предоставления конфигурации

1. Подтвердить exact frontend/backend SHA, QA-only bindings и действительную сессию. Отдельно убедиться, что anonymous запросы `/chat`, `/transcribe`, `/speech` отклоняются и флаги production OFF.
2. Текст: `POST /api/ai-coach/chat` с `{message,fen,side,language,history}`. Нужны HTTP 200, `generated:true`, `provider:"openai"`, правильная позиция и язык. Проверить последующий вопрос с историей; отсутствие выдуманных Stockfish scores. Ответ архива с `generated:false` не является подтверждением OpenAI.
3. Микрофон в реальном Chrome/Android и Safari/iOS: разрешить запись, записать короткую шахматную фразу, остановить; `POST /api/ai-coach/transcribe?language=ru` с фактическими audio bytes и Content-Type MediaRecorder должен дать корректный текст. Исправить текст и отправить. Проверить отказ в доступе, отзыв разрешения и повторную попытку.
4. Голос: `POST /api/ai-coach/speech` с `{text,language}` должен вернуть воспроизводимый `audio/wav`. Проверить точность прочтения ответа и шахматной нотации, автоматическое/ручное воспроизведение, остановку и отсутствие звука после закрытия. Realtime модель является генеративной: точность озвучивания требует реальной ручной оценки.
5. Повторить языковую проверку DE/EN/AZ/TR/UA/RU, мобильную/desktop проверку и выбранные реальные темы. Качество распознавания и произношения AZ/UA не подтверждено.
6. Проверить смену FEN/пользователя, освобождение микрофона, 429 без повторных автоматических запросов, существующий indexed-ply переход к Analysis и opt-out архивов. Провести обычный bounded QA, без нагрузочного теста сервиса.

Ограничения runtime: API timeout 25 s, UI timeout 30 s, audio output до 2 MiB, Realtime max_output_tokens=2048. Слишком длинное или незавершённое озвучивание возвращает ошибку; текст ответа сохраняется. Лимиты и concurrency process-local и не заменяют quota всего OpenAI project.

## Официальная документация, использованная при реализации

- https://developers.openai.com/api/docs/models/gpt-6-sol
- https://developers.openai.com/api/docs/guides/migrate-to-responses
- https://developers.openai.com/api/docs/guides/speech-to-text
- https://developers.openai.com/api/docs/guides/realtime-conversations
- https://developers.openai.com/api/docs/guides/voice-websockets
- https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create (объявленное устаревание старого Speech API)
