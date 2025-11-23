# Telegram Mini App для бронирования лодок

Это Nuxt 3 приложение, адаптированное для работы как Telegram Mini App.

## Настройка Telegram Mini App

### 1. Создание бота в Telegram

1. Откройте BotFather в Telegram: https://t.me/BotFather
2. Создайте нового бота командой `/newbot`
3. Следуйте инструкциям и получите токен бота
4. Настройте команды бота: `/setcommands` и добавьте команду `start - Открыть приложение`
5. Включите возможность назначения вебхука для вашего бота

### 2. Настройка веб-приложения

1. Создайте файл `.env` в корне проекта:
```
# Telegram Bot Settings
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_WEBAPP_URL=https://your-app-url.com

# Supabase Settings
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

2. Установите зависимости проекта:
```bash
npm install
```

3. Запустите разработческий сервер:
```bash
npm run dev
```

### 3. Настройка WebApp в BotFather

1. Откройте BotFather и выберите вашего бота
2. Используйте команду `/setmenubutton`
3. Введите URL вашего приложения (должен быть HTTPS)
4. Дайте название кнопке (например "Бронирование лодок")

### 4. Публикация приложения

1. Соберите приложение для production:
```bash
npm run build
```

2. Загрузите приложение на хостинг с поддержкой HTTPS
3. Настройте вебхук для вашего бота:
```
https://api.telegram.org/bot{YOUR_BOT_TOKEN}/setWebhook?url={YOUR_WEBHOOK_URL}/api/telegram/webhook
```

## Функциональность Telegram Mini App

- Адаптивный интерфейс, подстраивающийся под тему Telegram
- Доступ к данным пользователя Telegram
- Haptic Feedback при действиях
- Кнопка "Назад" в заголовке Telegram
- Оптимизированный UI для мобильного использования

## Разработка

Для локальной разработки необходимо использовать HTTPS. Вы можете использовать ngrok или similar сервис:

```bash
# Запустите приложение
npm run dev

# В другом терминале запустите ngrok
ngrok http 3000
```

Полученный HTTPS URL используйте в BotFather для настройки вашего мини-приложения.

## Диагностика Telegram

В файле `docs/telegram.md` описаны:

- обязательные переменные окружения;
- проверка и переустановка webhook;
- порядок тестирования инлайн‑кнопок и fallback в режим ссылок;
- где смотреть логи (pm2 / docker / dev-server).

Используйте этот чеклист при любых проблемах с уведомлениями или кнопками.

## Основные компоненты

- `app.vue` - корневой компонент с инициализацией Telegram WebApp SDK
- `components/UTelegramTheme.vue` - компонент для применения темы Telegram
- `plugins/telegram.js` - плагин для работы с Telegram WebApp API
- `server/api/telegram/webhook.ts` - API для обработки вебхуков от Telegram
