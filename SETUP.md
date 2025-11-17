# Инструкция по настройке проекта

## Быстрый старт

1. **Установите зависимости** (если еще не установлены):
```bash
npm install
```

2. **Создайте файл `.env`** в корне проекта со следующим содержимым:

```env
# Telegram Bot Settings (опционально для локальной разработки)
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBAPP_URL=http://localhost:3000
TELEGRAM_ADMIN_CHAT_ID=

# Supabase Settings (обязательно для работы с данными)
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_role_key

# JWT Settings (обязательно для аутентификации)
# Получите JWT секреты из Supabase Dashboard -> Settings -> API -> JWT Settings
JWT_SECRET=your-jwt-secret-here
# JWT_REFRESH_SECRET - опционально, если не указан, будет использован JWT_SECRET
# Рекомендуется использовать отдельный секрет для refresh токенов для лучшей безопасности
JWT_REFRESH_SECRET=your-refresh-secret-key-here

# Other Settings
DISABLE_REALTIME=false
NODE_ENV=development
```

3. **Запустите dev сервер**:
```bash
npm run dev
```

4. **Откройте браузер** по адресу: http://localhost:3000

## Настройка Supabase

Для полноценной работы приложения необходимо настроить Supabase:

1. Создайте проект на [supabase.com](https://supabase.com)
2. Получите ключи из настроек проекта (Settings -> API):
   - `SUPABASE_URL` - URL вашего проекта Supabase
   - `SUPABASE_KEY` - Anon (public) key
   - `SUPABASE_SERVICE_KEY` - Service Role key (обязателен для админских операций и создания пользователей)
3. Получите JWT секреты:
   - Откройте Settings -> API -> JWT Settings
   - Скопируйте `JWT Secret` в `JWT_SECRET`
   - Для `JWT_REFRESH_SECRET`: 
     * **Вариант 1 (рекомендуется)**: Создайте отдельный секрет для refresh токенов (более безопасно)
     * **Вариант 2 (упрощенный)**: Используйте тот же `JWT_SECRET` (можно оставить пустым или не указывать)
   - **Важно**: Если `JWT_REFRESH_SECRET` не указан, система автоматически использует `JWT_SECRET` для обоих типов токенов
4. Добавьте все ключи в файл `.env`
5. Выполните SQL скрипты из папки `database/` для создания необходимых таблиц

**Важно:** Service Role Key имеет полный доступ к базе данных и обходит RLS политики. Храните его в безопасности и никогда не коммитьте в репозиторий!

## Настройка Telegram Bot (опционально)

Для работы Telegram Mini App:

1. Создайте бота через [@BotFather](https://t.me/BotFather)
2. Получите токен бота
3. Добавьте токен в `.env` как `TELEGRAM_BOT_TOKEN`
4. Настройте WebApp URL в BotFather командой `/setmenubutton`

## Возможные проблемы

### Предупреждения о Supabase
Если видите предупреждения:
```
[@nuxt/supabase]  WARN  Missing supabase url
[@nuxt/supabase]  WARN  Missing supabase anon key
```

Это нормально для локальной разработки без настроенного Supabase. Приложение будет работать, но функционал, требующий базу данных, будет недоступен.

### Ошибки при загрузке данных
Если приложение показывает ошибку "Supabase не настроен", проверьте:
- Существует ли файл `.env` в корне проекта
- Правильно ли указаны `SUPABASE_URL` и `SUPABASE_KEY`
- Перезапустите dev сервер после изменения `.env`

### Ошибка "Missing SUPABASE_SERVICE_KEY"
Если видите ошибку:
```
ERROR  Missing SUPABASE_SERVICE_KEY in .env
```

Это означает, что не настроен Service Role Key. Он необходим для:
- Создания и обновления пользователей через Telegram авторизацию
- Админских операций
- Некоторых операций, требующих обхода RLS политик

Получите Service Role Key из Supabase Dashboard -> Settings -> API -> service_role key и добавьте в `.env` как `SUPABASE_SERVICE_KEY`.

## Структура проекта

- `pages/` - страницы приложения
- `components/` - Vue компоненты
- `composables/` - композаблы (переиспользуемая логика)
- `server/api/` - API endpoints
- `database/` - SQL скрипты для базы данных
- `assets/` - статические ресурсы (CSS, изображения)

## Команды

- `npm run dev` - запуск dev сервера
- `npm run build` - сборка для production
- `npm run preview` - предпросмотр production сборки
- `npm run dev:https` - запуск с HTTPS (для тестирования Telegram WebApp)

