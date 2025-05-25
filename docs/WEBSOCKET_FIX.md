# Исправление проблем с WebSocket Supabase Realtime

## Проблема
На продакшене возникает ошибка:
```
WebSocket connection to 'wss://zoxnjrycktmpkzkkekcg.supabase.co/realtime/v1/websocket?apikey=...' failed
```

## Решение

### 1. Отключение Realtime на продакшене

Добавьте переменную окружения:
```bash
DISABLE_REALTIME=true
```

### 2. Использование безопасного композабла

Вместо `useSupabaseClient()` используйте `useSupabaseSafe()`:

```typescript
// Вместо этого:
const supabase = useSupabaseClient()

// Используйте это:
const supabase = useSupabaseSafe()
```

### 3. Проверка статуса Realtime

```typescript
const supabase = useSupabaseSafe()

if (supabase.isRealtimeDisabled) {
  console.log('Realtime отключен')
  // Используйте polling или другие методы обновления данных
}
```

## Альтернативные решения

### 1. Настройка прокси-сервера
Если вы используете Nginx или другой прокси-сервер, добавьте поддержку WebSocket:

```nginx
location /realtime/ {
    proxy_pass https://your-supabase-url.supabase.co;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

### 2. Использование polling вместо realtime

```typescript
// Вместо realtime подписок используйте setInterval
const pollData = () => {
  setInterval(async () => {
    const { data } = await supabase.from('table').select('*')
    // Обновляем данные
  }, 5000) // Каждые 5 секунд
}
```

## Проверка работы

После применения исправлений:
1. Ошибки WebSocket должны исчезнуть
2. Приложение должно работать стабильно на продакшене
3. Данные будут обновляться через обычные HTTP запросы 