# Новая система авторизации и регистрации

## Обзор проблем и решений

### Проблемы которые были исправлены:

1. **❌ Сессия сбрасывалась после обновления страницы**
   - **Причина**: Неправильная настройка cookies для localhost
   - **Решение**: Исправлена конфигурация `supabase.cookieOptions.secure`

2. **❌ Отсутствовал триггер создания профиля**
   - **Причина**: При регистрации создавался пользователь в `auth.users`, но не в `profiles`
   - **Решение**: Создан SQL триггер `handle_new_user()`

3. **❌ Неправильная инициализация auth state**
   - **Причина**: Auth listener инициализировался неправильно
   - **Решение**: Переписан composable `useAuth()`

4. **❌ Hydration mismatches**
   - **Причина**: Различия между server и client состоянием
   - **Решение**: Правильное разделение server/client логики

## Архитектура новой системы

### 1. Composable `useAuth()`

Полностью переписанный composable с правильным управлением состоянием:

```typescript
const { 
  // Состояние
  user,           // Supabase User объект
  session,        // Supabase Session объект  
  profile,        // Профиль из таблицы profiles
  initializing,   // Флаг инициализации
  
  // Вычисляемые свойства
  isLoggedIn,     // Boolean - авторизован ли пользователь
  isAdmin,        // Boolean - является ли админом
  userEmail,      // Email пользователя
  userId,         // ID пользователя
  
  // Методы
  signIn,         // Вход по email/password
  signUp,         // Регистрация
  signOut,        // Выход
  signInWithOAuth,// OAuth вход
  updateProfile,  // Обновление профиля
  resetPassword   // Сброс пароля
} = useAuth()
```

### 2. Конфигурация Nuxt

Исправленная конфигурация в `nuxt.config.ts`:

```typescript
supabase: {
  redirect: false,
  cookieOptions: {
    maxAge: 60 * 60 * 24 * 7, // 7 дней
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production', // ✅ Исправляет localhost
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

### 3. Middleware

Обновленный middleware в `middleware/auth.ts`:

```typescript
export default defineNuxtRouteMiddleware((to, from) => {
  // Выполняем только на клиенте
  if (process.server) return

  const { isLoggedIn, initializing } = useAuth()
  
  // Ждем инициализации
  if (initializing.value) return
  
  // Редирект если не авторизован
  if (!isLoggedIn.value) {
    return navigateTo('/login')
  }
})
```

### 4. Plugin инициализации

Client-side plugin в `plugins/auth.client.ts`:

```typescript
export default defineNuxtPlugin(async () => {
  const { initializeAuth } = useAuth()
  await initializeAuth()
  console.log('Auth initialized successfully')
})
```

## Использование

### Базовое использование в компонентах

```vue
<template>
  <div>
    <div v-if="initializing">Загрузка...</div>
    <div v-else-if="isLoggedIn">
      <p>Привет, {{ userEmail }}!</p>
      <p v-if="isAdmin">Вы администратор</p>
      <button @click="handleSignOut">Выйти</button>
    </div>
    <div v-else>
      <p>Вы не авторизованы</p>
    </div>
  </div>
</template>

<script setup>
const { 
  user, 
  isLoggedIn, 
  isAdmin, 
  userEmail, 
  initializing, 
  signOut 
} = useAuth()

const handleSignOut = async () => {
  await signOut()
}
</script>
```

### Вход в систему

```vue
<script setup>
const { signIn } = useAuth()

const handleLogin = async () => {
  const result = await signIn(email.value, password.value)
  
  if (result.success) {
    // Успешный вход
    router.push('/')
  } else {
    // Ошибка
    console.error(result.error)
  }
}
</script>
```

### Регистрация

```vue
<script setup>
const { signUp } = useAuth()

const handleRegister = async () => {
  const metadata = {
    full_name: name.value,
    phone: phone.value
  }
  
  const result = await signUp(email.value, password.value, metadata)
  
  if (result.success) {
    // Успешная регистрация
    console.log('Проверьте email для подтверждения')
  } else {
    // Ошибка
    console.error(result.error)
  }
}
</script>
```

## База данных

### Таблица profiles

```sql
CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE,
  email text,
  name text,
  phone text,
  role text DEFAULT 'user',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
```

### Триггер автоматического создания профиля

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, phone, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'phone',
    'user'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

## Проверка работы

### 1. Выполните SQL скрипт

Выполните файл `database/fix-profile-trigger-simple.sql` в Supabase Dashboard.

### 2. Перезапустите приложение

```bash
npm run dev
```

### 3. Тестирование

1. Откройте приложение в браузере
2. Зарегистрируйте нового пользователя
3. Подтвердите email
4. Войдите в систему
5. Обновите страницу - сессия должна сохраниться ✅
6. Выйдите из системы
7. Войдите снова - все должно работать ✅

## Отладка

### Проверка cookies в DevTools

Откройте DevTools → Application → Cookies и проверьте:
- `sb-access-token` - должен быть установлен
- `sb-refresh-token` - должен быть установлен

### Проверка состояния в консоли

```javascript
// В консоли браузера
console.log('Auth state:', {
  user: window.user,
  session: window.session,
  profile: window.profile
})
```

### Логи для отладки

Composable выводит логи при изменении состояния:
```
Auth state changed: SIGNED_IN user@example.com
```

## Миграция существующих пользователей

Для существующих пользователей без профилей выполните:

```sql
INSERT INTO public.profiles (id, email, name, phone, role)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name'),
  au.raw_user_meta_data->>'phone',
  'user'
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL
AND au.email_confirmed_at IS NOT NULL;
```

## Заключение

✅ **Сессия теперь персистентна после обновления страницы**  
✅ **Автоматическое создание профилей при регистрации**  
✅ **Правильная инициализация auth state**  
✅ **Отсутствие hydration mismatches**  
✅ **Улучшенный UX и обработка ошибок**  

Система готова к использованию в продакшене! 