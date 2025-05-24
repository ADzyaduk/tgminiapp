# Исправления проблем с персистентностью сессии

## Проблема
Сессии Supabase не сохранялись после обновления страницы в development режиме.

## Основные причины
1. **Настройки cookies для HTTPS** - браузеры блокируют secure cookies на localhost
2. **Конфигурация localStorage** - неправильная настройка storage в Supabase
3. **Таймнг инициализации** - проблемы с восстановлением сессии при загрузке

## Примененные исправления

### 1. Обновлена конфигурация Nuxt (nuxt.config.ts)
```typescript
supabase: {
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production', // false в dev режиме
    httpOnly: false,
  },
  clientOptions: {
    auth: {
      persistSession: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    }
  }
}
```

### 2. Улучшен composable useAuth.ts
- Добавлено несколько попыток восстановления сессии
- Экспоненциальная задержка между попытками
- Дополнительное сохранение в localStorage
- Лучшая очистка при выходе

### 3. Создан debug utility (utils/authDebug.ts)
В dev режиме можно вызвать `window.debugAuth()` в консоли для диагностики.

### 4. Добавлен HTTPS скрипт
```bash
npm run dev:https
```
Для тестирования с secure cookies.

## Способы решения проблем

### Способ 1: Обычная разработка
```bash
npm run dev
```
- Secure cookies отключены для localhost
- Должно работать в большинстве браузеров

### Способ 2: HTTPS разработка
```bash
npm run dev:https
```
- Включает HTTPS на localhost
- Нужно принять self-signed сертификат

### Способ 3: Очистка браузера
1. Открыть DevTools (F12)
2. Application → Storage → Clear storage
3. Обновить страницу

### Способ 4: Диагностика
1. Войти в аккаунт
2. Открыть консоль браузера
3. Вызвать `debugAuth()` или `window.debugAuth()`
4. Проверить вывод

## Тестирование
1. Войдите в аккаунт
2. Обновите страницу (F5)
3. Проверьте, что остались авторизованными
4. Если проблема осталась - запустите `debugAuth()` в консоли

## Дополнительные заметки
- Проблема в основном в dev режиме
- В production с HTTPS должно работать стабильно
- Некоторые браузеры (Safari, Brave) более строгие к cookies 