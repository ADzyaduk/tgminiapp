# 🚨 Быстрое исправление: "telegraminit data not found"

## Проблема

При переходе на сервер авторизация через Telegram не работает с ошибкой "telegraminit data not found".

## ⚡ Быстрое решение (3 шага)

### 1. Добавьте Telegram WebApp скрипт

В `nuxt.config.ts` добавьте:

```typescript
export default defineNuxtConfig({
  app: {
    head: {
      script: [
        {
          src: "https://telegram.org/js/telegram-web-app.js",
          defer: true,
        },
      ],
    },
  },
  // ... existing config
});
```

### 2. Обновите URL в BotFather

1. Откройте @BotFather в Telegram
2. `/mybots` → [Ваш бот] → `Bot Settings` → `Menu Button`
3. Смените URL на: `https://ваш-домен.com` (обязательно HTTPS!)

### 3. Проверьте HTTPS

Убедитесь что ваш сайт работает по HTTPS. Telegram требует SSL!

## 🧪 Проверка

1. Перезапустите сервер
2. Откройте `/telegram-debug` для диагностики
3. Тестируйте только через бота в Telegram (не в браузере!)

## ✅ Готово!

После этих шагов авторизация должна работать.

---

📖 **Подробная инструкция**: см. `docs/TELEGRAM_PRODUCTION_FIX.md`
