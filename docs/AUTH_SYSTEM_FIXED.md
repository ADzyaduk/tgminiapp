# Исправленная система авторизации

## Проблемы которые были исправлены

### 1. Двойная инициализация
**Проблема**: `useAuth.ts` содержал дублирующую инициализацию которая конфликтовала с plugin.
**Решение**: Убрана лишняя инициализация, оставлен только plugin.

### 2. Отсутствие middleware для защиты роутов
**Проблема**: Страницы не были защищены, auth состояние не проверялось.
**Решение**: Созданы middleware:
- `middleware/auth.ts` - базовая защита авторизации
- `middleware/admin.ts` - защита для администраторов

### 3. Отсутствие redirect после логина
**Проблема**: После логина всегда перенаправляло на главную, даже если пользователь пытался попасть на `/admin`.
**Решение**: Добавлена поддержка redirect параметра в login странице.

### 4. Проблемы с инициализацией и тайминг
**Проблема**: Middleware выполнялись до завершения инициализации auth.
**Решение**: Добавлено ожидание инициализации в middleware с помощью while loop.

## Как это работает сейчас

### 1. Инициализация (plugins/auth.client.ts)
```typescript
export default defineNuxtPlugin(async (nuxtApp) => {
  const { initializeAuth, initializing } = useAuth()
  
  // Ждем инициализации
  await initializeAuth()
  
  // Добавляем хук для полной инициализации
  nuxtApp.hook('app:beforeMount', () => {
    return new Promise((resolve) => {
      const checkInitialization = () => {
        if (!initializing.value) {
          resolve(true)
        } else {
          setTimeout(checkInitialization, 10)
        }
      }
      checkInitialization()
    })
  })
})
```

### 2. Middleware защиты (middleware/admin.ts)
```typescript
export default defineNuxtRouteMiddleware(async (to, from) => {
  const { user, isAdmin, initializing } = useAuth()
  
  // Ждем завершения инициализации
  while (initializing.value) {
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  
  // Проверяем авторизацию и права
  if (!user.value) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
  
  if (!isAdmin.value) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Доступ запрещен'
    })
  }
})
```

### 3. Redirect в login (pages/login.vue)
```typescript
// Получаем redirect URL из query параметров
const redirectTo = computed(() => {
  const redirect = route.query.redirect as string
  return redirect && redirect !== '/login' ? redirect : '/'
})

// Перенаправляем после успешного логина
watch(isLoggedIn, (newValue) => {
  if (newValue) {
    router.push(redirectTo.value)
  }
})
```

## Использование

### 1. Защита страниц авторизацией
```vue
<script setup>
definePageMeta({
  middleware: 'auth'
})
</script>
```

### 2. Защита админских страниц
```vue
<script setup>
definePageMeta({
  middleware: 'admin'
})
</script>
```

### 3. Проверка прав в компонентах
```vue
<script setup>
const { user, isAdmin, isLoggedIn } = useAuth()
</script>

<template>
  <div v-if="isLoggedIn">
    <p>Привет, {{ user.email }}!</p>
    <AdminPanel v-if="isAdmin" />
  </div>
</template>
```

## Флоу авторизации

1. **Пользователь заходит на /admin**
   - Middleware проверяет auth состояние
   - Если не авторизован → redirect на `/login?redirect=%2Fadmin`
   - Если не админ → ошибка 403

2. **Пользователь логинится**
   - После успешного логина читается redirect параметр
   - Пользователь перенаправляется на `/admin`
   - Middleware снова проверяет права (теперь OK)

3. **Обновление страницы**
   - Plugin инициализирует auth состояние
   - Session восстанавливается из cookies
   - Middleware проверяет права и пропускает пользователя

## Настройки для production

В `nuxt.config.ts` настроены правильные cookie опции:

```typescript
supabase: {
  cookieOptions: {
    maxAge: 60 * 60 * 24 * 7, // 7 дней
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  },
  clientOptions: {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    }
  }
}
```

## Известные особенности

1. **SSR отключен** (`ssr: false`) - упрощает auth логику
2. **Client-only инициализация** - auth работает только на клиенте
3. **Middleware ждут инициализации** - предотвращают race conditions
4. **Fallback profile creation** - если RLS блокирует profile, создаем временный из user metadata 