# Настройка переменных окружения в Amvera

## Проблема: Ошибка 500 из-за отсутствия переменных окружения

Если вы видите ошибку:
```
@supabase/ssr: Your project's URL and API key are required to create a Supabase client!
```

Это означает, что не настроены переменные окружения Supabase в панели Amvera.

## Как добавить переменные окружения в Amvera

### Шаг 1: Откройте панель управления Amvera

1. Войдите в [Amvera Cloud](https://amvera.ru)
2. Откройте ваше приложение
3. Перейдите в раздел **«Переменные окружения»** или **«Environment Variables»**

### Шаг 2: Добавьте обязательные переменные

Добавьте следующие переменные окружения:

#### Supabase (обязательно)

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_anon_key_here
SUPABASE_SERVICE_KEY=your_service_role_key_here
```

**Где получить:**
- Откройте ваш проект в [Supabase Dashboard](https://supabase.com/dashboard)
- Перейдите в **Settings** → **API**
- Скопируйте:
  - **Project URL** → `SUPABASE_URL`
  - **anon public** key → `SUPABASE_KEY`
  - **service_role** key → `SUPABASE_SERVICE_KEY`

#### JWT Secrets (обязательно)

```
JWT_SECRET=your-jwt-secret-here
JWT_REFRESH_SECRET=your-refresh-secret-here
```

**Где получить:**
- В Supabase Dashboard: **Settings** → **API** → **JWT Settings**
- Скопируйте **JWT Secret** → `JWT_SECRET`
- Для `JWT_REFRESH_SECRET`: можно использовать тот же `JWT_SECRET` или создать отдельный

#### Telegram Bot (обязательно для работы бота)

```
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_WEBAPP_URL=https://your-app-url.amvera.app
TELEGRAM_ADMIN_CHAT_ID=your_admin_chat_id
```

**Где получить:**
- `TELEGRAM_BOT_TOKEN`: получите от [@BotFather](https://t.me/BotFather)
- `TELEGRAM_WEBAPP_URL`: URL вашего приложения в Amvera (например, `https://your-app.amvera.app`)
- `TELEGRAM_ADMIN_CHAT_ID`: ваш Telegram Chat ID (можно получить через бота)

#### Дополнительные настройки

```
NODE_ENV=production
DISABLE_REALTIME=false
```

### Шаг 3: Сохраните переменные

1. Нажмите **«Сохранить»** или **«Save»**
2. Amvera автоматически перезапустит приложение с новыми переменными

### Шаг 4: Проверьте работу

1. Подождите несколько секунд, пока приложение перезапустится
2. Обновите страницу приложения
3. Ошибка 500 должна исчезнуть

## Полный список переменных

Вот все переменные, которые нужно добавить:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_anon_key_here
SUPABASE_SERVICE_KEY=your_service_role_key_here

# JWT
JWT_SECRET=your-jwt-secret-here
JWT_REFRESH_SECRET=your-refresh-secret-here

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_WEBAPP_URL=https://your-app-url.amvera.app
TELEGRAM_ADMIN_CHAT_ID=your_admin_chat_id

# Other
NODE_ENV=production
DISABLE_REALTIME=false
```

## Важные замечания

1. **Не коммитьте секреты в Git!** Переменные окружения добавляются только в панели Amvera
2. **Service Role Key** имеет полный доступ к базе данных - храните его в безопасности
3. После добавления переменных приложение автоматически перезапустится
4. Если ошибка не исчезла, проверьте:
   - Правильность значений переменных
   - Что все переменные добавлены (не пропущены)
   - Логи приложения на наличие других ошибок

## Проверка переменных

После добавления переменных проверьте логи приложения:
- Не должно быть ошибок `Missing supabase url` или `Missing supabase anon key`
- Приложение должно успешно подключаться к Supabase

## Если проблема сохраняется

1. Проверьте логи приложения в панели Amvera
2. Убедитесь, что все переменные добавлены правильно
3. Проверьте, что значения переменных скопированы полностью (без лишних пробелов)
4. Перезапустите приложение вручную в панели Amvera

