# Интеграция с Telegram

Это руководство описывает настройку и использование интеграции с Telegram в приложении для бронирования лодок.

## Содержание

1. [Основные возможности](#основные-возможности)
2. [Настройка Telegram бота](#настройка-telegram-бота)
3. [Настройка Mini App](#настройка-mini-app)
4. [Настройка базы данных](#настройка-базы-данных)
5. [Уведомления пользователей](#уведомления-пользователей)
6. [Администрирование через Telegram](#администрирование-через-telegram)
7. [Тестирование и отладка](#тестирование-и-отладка)
8. [Список API и компонентов](#список-api-и-компонентов)

## Основные возможности

- **Telegram Mini App**: Пользователи могут работать с приложением прямо в Telegram
- **Уведомления о бронированиях**: Администраторы и пользователи получают уведомления
- **Управление бронированиями**: Подтверждение/отмена бронирований прямо из Telegram
- **Связывание аккаунтов**: Пользователи могут привязать свой Telegram профиль
- **Напоминания**: Автоматические напоминания о предстоящих бронированиях

## Настройка Telegram бота

1. **Создание бота**

   Откройте [@BotFather](https://t.me/BotFather) в Telegram и выполните следующие шаги:
   
   ```
   /newbot
   ```
   
   Следуйте инструкциям для создания нового бота. После создания вы получите токен бота.

2. **Настройка команд бота**

   ```
   /setcommands
   ```
   
   Используйте следующий список команд:
   
   ```
   start - Открыть приложение
   connect - Привязать аккаунт
   bookings - Мои бронирования
   help - Справка
   ```

3. **Настройка описания**

   ```
   /setdescription
   ```
   
   Введите описание вашего бота, например:
   
   ```
   Бот для бронирования лодок. Получайте уведомления о бронированиях, подтверждайте или отменяйте их прямо здесь.
   ```

4. **Настройка меню кнопки для Mini App**

   ```
   /setmenubutton
   ```
   
   Введите URL вашего веб-приложения и название кнопки, например "Бронирование лодок".

## Настройка Mini App

1. **Установка зависимостей**

   ```bash
   # Установите необходимые пакеты
   npm install @twa-dev/sdk vue-tg
   ```

2. **Добавление переменных окружения**

   Создайте файл `.env` (или обновите существующий):
   
   ```
   # Telegram Bot Settings
   TELEGRAM_BOT_TOKEN=ваш_токен_бота_здесь
   TELEGRAM_WEBAPP_URL=https://ваш-домен.com
   
   # Cron Settings
   CRON_SECRET=секретный_ключ_для_cron
   ```

3. **Настройка Webhook**

   После публикации приложения на сервер, настройте webhook:
   
   ```
   https://api.telegram.org/bot{TOKEN}/setWebhook?url={URL}/api/telegram/webhook
   ```
   
   Где `{TOKEN}` - ваш токен бота, а `{URL}` - URL вашего приложения.

## Настройка базы данных

1. **Выполнение SQL скрипта**

   В панели администратора Supabase откройте SQL Editor и выполните скрипт из файла `docs/supabase-telegram-schema.sql`.
   
   Этот скрипт создаст необходимые таблицы и настроит политики доступа.

2. **Проверка таблиц**

   После выполнения скрипта, проверьте следующие таблицы:
   
   - `profiles` - должна иметь поле `telegram_id`
   - `telegram_users` - таблица для хранения данных пользователей Telegram
   - `telegram_notifications` - таблица для журналирования уведомлений
   - `bookings` - должна иметь поле `updated_by`

## Уведомления пользователей

Система уведомлений поддерживает следующие типы сообщений:

1. **Новое бронирование**
   - Отправляется администраторам и менеджерам соответствующих лодок
   - Содержит информацию о клиенте, дате и времени бронирования
   - Включает кнопки для быстрого подтверждения или отмены

2. **Изменение статуса бронирования**
   - Отправляется клиенту и администраторам
   - Уведомляет о подтверждении или отмене бронирования

3. **Напоминания**
   - За день до бронирования
   - За несколько часов до бронирования
   - Настраивается через cron-задачи

### Настройка cron-задач для напоминаний

Для отправки регулярных напоминаний настройте следующие cron-задачи на сервере:

```
# Ежедневное напоминание в 19:00 о бронированиях на следующий день
0 19 * * * curl "https://ваш-домен.com/api/cron/send-reminders?days=1&secret=ваш_cron_secret"

# Напоминание за 3 часа до бронирования
0 * * * * curl "https://ваш-домен.com/api/cron/send-reminders?hours=3&secret=ваш_cron_secret"
```

## Администрирование через Telegram

Администраторы и менеджеры могут выполнять следующие действия прямо из Telegram:

1. **Подтверждение/отмена бронирований**
   - При получении уведомления о новом бронировании, используйте кнопки "Подтвердить" или "Отклонить"
   - Статус бронирования обновится автоматически
   - Клиент получит уведомление о изменении статуса

2. **Просмотр предстоящих бронирований**
   - Используйте команду `/bookings` для просмотра ваших бронирований

3. **Открытие полного интерфейса управления**
   - Перейдите в полную версию приложения через кнопку "Открыть управление"

## Тестирование и отладка

### Локальная разработка

1. **Настройка ngrok**

   Для тестирования webhook и Mini App на локальной машине:
   
   ```bash
   # Запустите приложение
   npm run dev
   
   # В отдельном терминале запустите ngrok
   ngrok http 3000
   ```
   
   Используйте полученный HTTPS URL для настройки webhook и Mini App.

2. **Тестирование с Telegram Bot API**

   Для проверки отправки сообщений через бота:
   
   ```
   https://api.telegram.org/bot{TOKEN}/getUpdates
   ```
   
   Это покажет недавние запросы к боту для отладки.

## Список API и компонентов

### Серверные API

1. `/api/telegram/webhook` - Обработчик webhook от Telegram
2. `/api/telegram/callback` - Обработчик callback-запросов от inline кнопок
3. `/api/cron/send-reminders` - API для отправки напоминаний через cron
4. `/api/bookings/[id]/status` - API для обновления статуса бронирования

### Компоненты

1. `TelegramConnect.vue` - Компонент для связывания аккаунта с Telegram
2. `UTelegramTheme.vue` - Компонент для настройки стилей в Telegram Mini App

### Плагины и утилиты

1. `plugins/telegram.js` - Плагин для работы с Telegram WebApp API
2. `server/utils/telegram-notifications.ts` - Утилиты для отправки уведомлений 