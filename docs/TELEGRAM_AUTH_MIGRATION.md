# 🚀 Миграция на Telegram-only авторизацию

## 📋 Что мы создали

Основываясь на статье [с Habr](https://habr.com/ru/articles/889270/), мы реализовали полноценную авторизацию только через Telegram Mini Apps с валидацией `initData` и JWT токенами.

## 🛠️ Новая архитектура

### 1. Компоненты авторизации

- **`composables/useTelegramAuth.ts`** - основной composable для Telegram авторизации
- **`server/api/telegram/auth.post.ts`** - валидация initData и выдача JWT токенов
- **`server/api/telegram/check-auth.get.ts`** - проверка и обновление токенов
- **`server/api/telegram/logout.post.ts`** - выход из системы
- **`server/api/telegram/update-phone.post.ts`** - обновление номера телефона
- **`middleware/telegram-auth.ts`** - middleware для защиты страниц
- **`plugins/telegram-auth.client.ts`** - инициализация авторизации
- **`components/TelegramPhoneInput.vue`** - компонент ввода телефона

### 2. Демо страница

- **`pages/telegram-auth.vue`** - демонстрация новой системы авторизации

## 🔧 Настройка переменных окружения

Добавьте в ваш `.env` файл:

```env
# JWT секреты для токенов (ОБЯЗАТЕЛЬНО!)
JWT_SECRET=your-very-secure-jwt-secret-here-min-32-chars
JWT_REFRESH_SECRET=your-very-secure-refresh-secret-here-min-32-chars

# Существующие переменные
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
```

## 🚨 Генерация безопасных секретов

```bash
# Генерация секретов для JWT
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
```

## 🎯 Принцип работы

### 1. Аутентификация

1. **Клиент** получает `initData` из Telegram WebApp API
2. **Клиент** отправляет `initData` на `/api/telegram/auth`
3. **Сервер** валидирует `initData` с помощью bot token
4. **Сервер** создает/обновляет пользователя в БД
5. **Сервер** генерирует Access (15 мин) и Refresh (7 дней) JWT токены
6. **Сервер** устанавливает токены в HTTP-only cookies
7. **Клиент** авторизован!

### 2. Авторизация запросов

1. **Клиент** делает запрос (автоматически отправляются cookies)
2. **Сервер** проверяет Access token из cookies
3. Если токен истек → проверяет Refresh token
4. Если Refresh token валиден → обновляет оба токена
5. **Сервер** возвращает данные пользователя

### 3. Номер телефона

- Единственное что нужно вводить пользователю
- Сохраняется через отдельный API `/api/telegram/update-phone`
- Необходим для бронирований

## 📱 Использование

### В компонентах

```vue
<script setup>
const { isAuthenticated, isLoading, profile, userName, signOut, updatePhone } =
  useTelegramAuth();
</script>

<template>
  <div v-if="isLoading">Загрузка...</div>
  <div v-else-if="!isAuthenticated">Не авторизован</div>
  <div v-else>
    <h1>Привет, {{ userName }}!</h1>
    <p>ID: {{ profile.telegram_id }}</p>
    <button @click="signOut">Выйти</button>
  </div>
</template>
```

### Защита страниц

```vue
<script setup>
// Добавить middleware для защиты страницы
definePageMeta({
  middleware: "telegram-auth",
});
</script>
```

## 🔄 План миграции

### Шаг 1: Тестирование новой системы

1. **Не трогайте** существующую авторизацию
2. **Добавьте** переменные окружения
3. **Протестируйте** на `/telegram-auth`
4. **Убедитесь** что все работает

### Шаг 2: Постепенная миграция

1. **Замените** `useAuth` на `useTelegramAuth` в новых компонентах
2. **Обновите** middleware на `telegram-auth`
3. **Протестируйте** каждую страницу

### Шаг 3: Полная замена

1. **Обновите** главную страницу
2. **Удалите** страницы `/login` и `/register`
3. **Очистите** старые composables и middleware
4. **Обновите** конфигурацию Supabase

## ✅ Преимущества новой системы

1. **Безопасность** - валидация initData через HMAC
2. **Простота** - не нужна регистрация через email
3. **UX** - быстрый доступ через Telegram
4. **Уведомления** - автоматическая интеграция с Telegram
5. **Производительность** - JWT токены в cookies

## 🔍 Отладка

### Development режим

- В `NODE_ENV=development` валидация `initData` отключена
- Используются фейковые данные пользователя
- Все работает без реального Telegram Bot

### Логи

```bash
# Проверка токенов
curl -b cookies.txt http://localhost:3000/api/telegram/check-auth

# Тест авторизации
curl -X POST http://localhost:3000/api/telegram/auth \
  -H "Content-Type: application/json" \
  -d '{"initData":"fake_data_for_dev"}'
```

### Отладка в браузере

```javascript
// В консоли браузера
console.log("TG Data:", window.Telegram?.WebApp?.initData);
console.log("Auth state:", document.cookie);
```

## 🚨 Безопасность

1. **HTTPS обязателен** для production
2. **JWT секреты** должны быть уникальными и сложными
3. **HTTP-only cookies** защищают от XSS
4. **SameSite=lax** защищает от CSRF
5. **Валидация initData** предотвращает подделку

## 🌐 Production готовность

- ✅ Валидация `initData` через bot token
- ✅ JWT токены с коротким временем жизни
- ✅ Автоматическое обновление токенов
- ✅ HTTP-only cookies
- ✅ Защита от CSRF и XSS
- ✅ Обработка ошибок
- ✅ Логирование операций

## 🎉 Готово!

Теперь у вас есть современная, безопасная система авторизации через Telegram, которая:

- 🚀 **Быстрая** - авторизация в один клик
- 🔒 **Безопасная** - валидация через Telegram
- 🎯 **Простая** - не нужна регистрация
- 📱 **Удобная** - интеграция с уведомлениями
- 🛠️ **Надежная** - JWT токены и автообновление
