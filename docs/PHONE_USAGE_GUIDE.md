# 📞 Руководство по работе с номерами телефонов в Telegram Mini App

## 🎯 Способы получения номера телефона

### 1. **Автоматический запрос при авторизации** ⭐ (Рекомендуемый)

Система автоматически запрашивает номер телефона, если его нет у пользователя:

```vue
<!-- Автоматически показывается при входе -->
<TelegramPhoneInput
  :show-phone-input="needsPhone"
  @success="handlePhoneSuccess"
  @skip="handlePhoneSkip"
/>
```

**Когда срабатывает:**

- При первой авторизации через Telegram
- Если в профиле нет поля `phone`

### 2. **Ручное добавление кнопкой**

Пользователь может добавить номер в любое время:

```vue
<UButton
  v-if="!profile?.phone"
  @click="showPhoneInput = true"
  variant="soft"
  color="warning"
>
  📞 Добавить номер телефона
</UButton>
```

### 3. **Автоматическое получение через Telegram WebApp API** 🆕

Новый способ - запрос номера напрямую через Telegram:

```vue
<UButton @click="requestFromTelegram" color="info">
  📱 Получить автоматически из Telegram
</UButton>
```

```typescript
const { requestTelegramContact } = useTelegramAuth();

const requestFromTelegram = async () => {
  const result = await requestTelegramContact();

  if (result.success) {
    console.log("Phone:", result.phone);
    // Автоматически сохраняется
  }
};
```

## 🔄 Как это работает

### Логика проверки номера телефона:

```typescript
// В composable useTelegramAuth
watch(
  [isAuthenticated, profile],
  ([auth, prof]) => {
    if (auth && prof && !prof.phone) {
      needsPhone.value = true; // Показать форму ввода
    }
  },
  { immediate: true }
);
```

### API для сохранения:

```typescript
// POST /api/telegram/update-phone
{
  "phone": "+71234567890"
}
```

### Обновление профиля:

```typescript
const updatePhone = async (phone: string) => {
  const response = await $fetch("/api/telegram/update-phone", {
    method: "POST",
    body: { phone },
  });

  // Автоматически обновляет profile.value.phone
};
```

## 📱 Использование в компонентах

### Проверка наличия номера:

```vue
<template>
  <div v-if="profile?.phone">Телефон: {{ profile.phone }}</div>
  <div v-else>
    <UButton @click="requestPhone">Добавить телефон</UButton>
  </div>
</template>

<script setup>
const { profile, updatePhone } = useTelegramAuth();

const requestPhone = async () => {
  // Логика запроса телефона
};
</script>
```

### В формах бронирования:

```vue
<UFormField label="Телефон" :required="!profile?.phone">
  <UInput
    v-model="guestPhone"
    :placeholder="profile?.phone || '+7 (___) ___-__-__'"
    :disabled="!!profile?.phone"
  />
</UFormField>
```

## 🛠️ Настройка и валидация

### Форматирование номера:

```typescript
const formatPhone = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const value = input.value.replace(/\D/g, "");

  // Автоматическое форматирование: +7 (XXX) XXX-XX-XX
  let formatted = "";
  if (value.startsWith("8")) {
    formatted = "+7" + value.substring(1);
  } else if (value.startsWith("7")) {
    formatted = "+" + value;
  }
  // ... форматирование
};
```

### Валидация:

```typescript
const isValidPhone = computed(() => {
  const cleaned = phone.value.replace(/\D/g, "");
  return cleaned.length === 11 && cleaned.startsWith("7");
});
```

## 🔐 Безопасность

### Почему Telegram не передает номер автоматически?

1. **Приватность** - номер телефона считается чувствительными данными
2. **Согласие пользователя** - требуется явное разрешение
3. **Контроль** - пользователь решает когда поделиться номером

### Что сохраняется в базе:

```sql
-- Таблица profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  telegram_id TEXT UNIQUE,
  phone TEXT, -- Сохраняется здесь
  name TEXT,
  email TEXT,
  role TEXT DEFAULT 'user'
);
```

## 📊 Статистика и мониторинг

### Проверка заполненности телефонов:

```sql
-- Сколько пользователей без телефона
SELECT COUNT(*) FROM profiles
WHERE telegram_id IS NOT NULL
AND (phone IS NULL OR phone = '');

-- Пользователи с телефонами
SELECT COUNT(*) FROM profiles
WHERE phone IS NOT NULL AND phone != '';
```

### В админ панели:

```vue
<template>
  <div class="stats">
    <div>Пользователей с телефоном: {{ usersWithPhone }}</div>
    <div>Пользователей без телефона: {{ usersWithoutPhone }}</div>
  </div>
</template>
```

## 🚨 Частые проблемы и решения

### Проблема: Telegram не запрашивает контакт

**Причина**: Не все версии Telegram поддерживают `requestContact()`

**Решение**:

```typescript
if (!tg.requestContact) {
  // Показать обычную форму ввода
  showManualInput.value = true;
}
```

### Проблема: Пользователь отказался делиться номером

**Решение**: Всегда предоставлять альтернативу - ручной ввод

```vue
<div v-if="contactRequestFailed">
  <p>Не удалось получить номер автоматически</p>
  <UInput v-model="phone" placeholder="Введите вручную" />
</div>
```

### Проблема: Неправильный формат номера

**Решение**: Валидация и нормализация

```typescript
const normalizePhone = (phone: string) => {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("8")) {
    cleaned = "7" + cleaned.substring(1);
  }
  return "+" + cleaned;
};
```

## ✅ Рекомендации

### Лучшие практики:

1. **Запрашивайте номер только когда нужно** - не сразу при входе
2. **Предоставляйте выбор** - автоматически или вручную
3. **Объясняйте зачем нужен номер** - "для уведомлений о бронировании"
4. **Разрешайте пропустить** - можно ввести позже
5. **Сохраняйте один раз** - не запрашивайте повторно

### UX рекомендации:

```vue
<div class="phone-request">
  <h3>📞 Номер телефона</h3>
  <p>Нужен для уведомлений о статусе бронирования</p>

  <UButton @click="requestFromTelegram">
    📱 Получить из Telegram
  </UButton>

  <p>или</p>

  <UInput v-model="phone" placeholder="Введите вручную" />

  <UButton @click="skip" variant="ghost">
    Пропустить (добавлю позже)
  </UButton>
</div>
```

---

**Итог**: Теперь у вас есть 3 способа получения номера телефона с гибкой системой, которая работает во всех ситуациях! 🎉
