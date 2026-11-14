# Пилот командных турниров M3 в QA

PR [№194](https://github.com/sem2025ger/azchat-chess/pull/194) остаётся Draft. Используйте ветку `feat/team-tournaments-m3-self-service-20261106` и Supabase QA `iukmpcytsuofqhxsumbu`. Рабочие ссылки и результаты появятся после проверки. Сценарий для проверяющего описан в [плане пилота](team-tournaments-m3-pilot.md).

## 1. Создайте отдельный сервер на Render

1. Откройте [Render Dashboard](https://dashboard.render.com) → **My Workspace** → **New** → **Web Service** → **Git Provider**. Выберите `sem2025ger/azchat-chess`.
2. Заполните поля по таблице. Root Directory, Build Command и Start Command сверены с существующим QA-сервером.

   | Поле | Что выбрать или вписать |
   |---|---|
   | Name | `chessaz-m3-qa-api` |
   | Branch | `feat/team-tournaments-m3-self-service-20261106` |
   | Language | **Node** |
   | Region / Instance Type | **Oregon / Free**, как у существующего QA-сервера |
   | Root Directory | Оставьте пустым |
   | Build Command | `cd server && npm ci` |
   | Start Command | `cd server && npm start` |
   | Health Check Path | `/health` |
   | Auto-Deploy | **Off** в **Advanced** или, если пункт виден после создания, сразу в **Settings → Auto-Deploy** |

3. В [Supabase QA](https://supabase.com/dashboard/project/iukmpcytsuofqhxsumbu) откройте **Connect** для URL проекта и **Settings → API Keys → Legacy anon, service_role API keys** для ключей. В Render, в **Environment Variables**, добавьте записи из таблицы. Ключи вводите прямо в панели.

   | Имя | Откуда взять значение |
   |---|---|
   | `SUPABASE_URL` | **Connect → Project URL** проекта QA |
   | `SUPABASE_ANON_KEY` | QA → **Settings → API Keys** → ключ `anon` |
   | `SUPABASE_SERVICE_KEY` | Там же → ключ `service_role` |
   | `FRONTEND_URL` | URL ветки из раздела 3, только схема и домен. Для первого запуска можно указать текущий URL Preview этой ветки. |
   | `NODE_ENV` | `production`, стандартный режим Node в отдельном QA-сервисе |
   | `TEAM_TOURNAMENTS_ENABLED` | `true` |
   | `TEAM_TOURNAMENTS_M3_ENABLED` | `true` |

   Render сам предоставляет `PORT` и `RENDER_GIT_COMMIT`. Для пилота оставьте опциональные `SUPABASE_PUBLISHABLE_KEY` и `SUPABASE_SERVICE_ROLE_KEY` пустыми, чтобы ключи выбирались из таблицы выше. Опциональные настройки Sentry, ИИ, архива, профилей игроков, частного Spieltag и durable games оставьте незаполненными. Для M3 достаточно двух флагов из таблицы. Pre-Deploy Command оставьте пустым.

4. Нажмите **Create Web Service**. На странице нового сервиса скопируйте назначенный публичный URL. Если Render назначил имя с суффиксом, перед запуском автоматики потребуется согласовать точный домен. Сейчас workflow разрешает только `chessaz-m3-qa-api.onrender.com`.
5. В **Deploys** дождитесь статуса **Live** и проверьте, что `/health` возвращает HTTP 200 и поле `commit` с полным SHA. Перед запуском пилота обновите этот сервис по шагу 2 ниже. Существующий `chessaz-deutsch-qa-api` оставьте на M2.

## 2. Подготовьте ручной запуск в GitHub

1. В [репозитории](https://github.com/sem2025ger/azchat-chess) откройте **Settings → Secrets and variables → Actions → Repository secrets**. Добавьте отсутствующие записи через **New repository secret**.

   | Имя | Источник |
   |---|---|
   | `QA_SUPABASE_URL` | URL проекта Supabase QA из шага 1 |
   | `QA_SUPABASE_ANON_KEY` | Ключ `anon` того же проекта |
   | `QA_SUPABASE_SERVICE_KEY` | Ключ `service_role` того же проекта |
   | `M3_QA_API_URL` | Публичный URL нового сервиса Render |
   | `QA_DATABASE_URL` | Переиспользуйте секрет, объявленный в workflow импорта Lichess. Если записи нет, возьмите **Connect → Session pooler** в проекте QA и вставьте строку с паролем базы прямо в GitHub. Нужен URL с TLS, желательно Session pooler (порт 5432). |

2. На Render откройте **chessaz-m3-qa-api → Manual Deploy → Deploy latest commit**. Дождитесь **Live**. Поле `commit` в `/health` должно совпасть с последним коммитом [PR №194](https://github.com/sem2025ger/azchat-chess/pull/194). GitHub сверяет его автоматически до подключения пилота к базе.
3. Если метки `run-qa-m3-pilot` ещё нет, в репозитории откройте **Issues → Labels → New label** и создайте её с этим точным именем. После зелёного CI откройте **PR №194 → Labels** и выберите `run-qa-m3-pilot`.
4. Откройте **Actions → QA M3 hosted pilot → нужный запуск → Summary**. Там будут результаты API, REST, RPC и PostgreSQL по шагам 1–17 и итог очистки. Скрипт создаёт 23 временных аккаунта: O, A, C1–C4, P1–P16 и S. A используется как пятый капитан в тесте на заполнение и как арбитр основного события.
5. После запуска workflow снимает метку автоматически. Для нового прогона дождитесь завершения предыдущего, при необходимости снимите оставшуюся метку и добавьте её снова. При аварийном отключении runner используйте **Re-run all jobs** у старого запуска только для восстановления его очистки. Такой повтор очищает данные этого запуска. Новый пилот начинается при повторном добавлении метки.
6. Шаги 3 и 13 включают ручное подтверждение возврата после входа и карточки на главной. Для шага 2 отдельно проверьте **Logs** нового Render-сервиса за время пилота. Для поиска используйте признаки вроде 64 символов hex в параметре приглашения или в поле тела запроса. Не копируйте реальные токены в поиск или отчёт. Таблица автоматики проверяет хеширование и отсутствие исходного токена в данных турнира. При утечке остановите приёмку и сохраните только обезличенное описание.

## 3. Подготовьте Preview для этой ветки

1. В [Vercel Dashboard](https://vercel.com/dashboard) выберите **chessaz-preview-workspace → Settings → Environment Variables → Add New**. Для каждой записи укажите только **Preview → Specific Git Branch** и ветку `feat/team-tournaments-m3-self-service-20261106`.

   | Имя | Откуда взять значение |
   |---|---|
   | `VITE_SERVER_URL` | Публичный URL нового QA-сервиса Render |
   | `VITE_TEAM_TOURNAMENTS_ENABLED` | `true` |
   | `VITE_TEAM_TOURNAMENTS_M3_ENABLED` | `true` |
   | `VITE_SUPABASE_URL` | URL проекта Supabase QA |
   | `VITE_SUPABASE_ANON_KEY` | Ключ `anon` того же проекта QA |
   | `VITE_QA_AUTH_BRANCH_ORIGIN` | Стабильный Preview-домен именно этой ветки из **Deployments → Deployment Details → Domains**. Приложение использует его для ссылок из письма. |

   Проверяющий (Claude) может установить URL и флаги через Vercel connector при наличии доступа. Ключ вводит владелец. `VITE_*` встраиваются в браузерную сборку. В этих настройках допустим только публичный ключ `anon`.

2. В **Deployments** выберите Preview этой ветки и нужного SHA → **⋯ → Redeploy**. Если сборки для этого SHA ещё нет, нажмите **Create Deployment**, укажите полное имя ветки M3 и проверьте, что выбран **Preview** и нужный SHA. После статуса **Ready** откройте ссылку. [Создание сборки из ветки](https://vercel.com/docs/git#creating-a-deployment-from-a-git-reference) Для регистрации с подтверждением письма в Supabase QA откройте **Authentication → URL Configuration → Redirect URLs → Add URL** и разрешите возврат на `/profile` этого конкретного Preview. Укажите `https://<stable-preview-host>/profile` и откройте этот же стабильный домен для ручной проверки. **Site URL** менять не требуется. Если меняется домен после пересборки, перепроверьте разрешённый адрес.
3. Проверьте совпадение SHA у Vercel и Render. На десктопе используйте **Spieltag → Turniere**. На телефоне откройте на том же Preview `/spieltag?tab=turniere` напрямую.

## 4. Короткая ручная проверка на компьютере и телефоне

1. Зарегистрируйте в QA Preview три тестовых аккаунта: организатор, капитан и игрок. **Выполняйте SQL ниже только в Supabase QA с ID проекта `iukmpcytsuofqhxsumbu`.** Откройте [SQL Editor](https://supabase.com/dashboard/project/iukmpcytsuofqhxsumbu/sql/new), замените `m3-organizer@example.com` на адрес тестового организатора и нажмите **Run**. Если аккаунт новый, запрос должен вернуть его `user_id`. Если строка отсутствует, проверьте адрес и регистрацию в QA.

   ```sql
   INSERT INTO public.team_tournament_organizers (user_id)
   SELECT u.id
   FROM auth.users AS u
   JOIN public.profiles AS p ON p.id = u.id
   WHERE lower(u.email) = lower('m3-organizer@example.com')
   ON CONFLICT (user_id) DO NOTHING
   RETURNING user_id;
   ```

   После ручной проверки снимите право создавать новые турниры тем же адресом. Этот запрос убирает только разрешение на создание.

   ```sql
   DELETE FROM public.team_tournament_organizers AS o
   USING auth.users AS u
   WHERE o.user_id = u.id
     AND lower(u.email) = lower('m3-organizer@example.com')
   RETURNING o.user_id;
   ```

   Для матча нужны две команды. В коротком сценарии аккаунт игрока также принимает приглашение стать капитаном второй команды. Каждый капитан заявляет себя на единственную доску и подтверждает своё участие. Аккаунт организатора используется для управления турниром.
2. Организатор создаёт турнир на **одну доску**, минимум две команды и ближайший удобный дедлайн, затем копирует две разные ссылки приглашения.
3. В отдельном окне выйдите из аккаунта капитана и откройте его ссылку. Нажмите **Войти**, войдите и убедитесь, что адрес вернулся точно на `/spieltag?tab=turniere&tournament=<id>&invite=<token>`. Примите приглашение. В другом проходе проверьте подтверждение регистрации через письмо на QA Preview. Ссылки с токенами оставьте в тестовом окне.
4. Оба капитана заявляют составы, игроки подтверждают участие и капитаны отправляют составы. После дедлайна обновите страницу. Игрок открывает карточку турнира на главной, сверяет раунд, соперника, цвет и кнопки **1 / ½ / 0**, отправляет результат. Соперник проверяет результат со своей стороны и подтверждает.
5. Повторите просмотр и переход по свежему приглашению на телефоне. В отчёт занесите SHA, Preview, фактические действия и итоги. Для примера URL закройте токен. Ручные QA-данные ведите отдельным списком для последующей согласованной очистки.
