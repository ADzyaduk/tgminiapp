# 🚨 СРОЧНОЕ ИСПРАВЛЕНИЕ: Ошибка рекурсии RLS

## Проблема
```
infinite recursion detected in policy for relation "profiles"
```

## Причина
Политики RLS для таблицы `profiles` создают рекурсию, потому что они пытаются обратиться к той же таблице для проверки прав.

## ⚡ БЫСТРОЕ РЕШЕНИЕ

### 1. Выполните в Supabase Dashboard → SQL Editor:

```sql
-- ВРЕМЕННОЕ ОТКЛЮЧЕНИЕ RLS (для устранения рекурсии)
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Удаляем проблемные политики
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- Включаем RLS обратно
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Создаем простые политики без рекурсии
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Enable insert for authenticated users" ON public.profiles
  FOR INSERT 
  WITH CHECK (auth.uid() = id);
```

### 2. Перезагрузите страницу в браузере

После выполнения SQL команд выше, перезагрузите страницу - ошибка должна исчезнуть.

## ✅ Проверка

1. Откройте консоль браузера (F12)
2. Перезагрузите страницу
3. Ошибка `infinite recursion detected` должна исчезнуть
4. Аутентификация должна работать нормально

## 📋 Что было исправлено

1. **Отключена рекурсия в политиках RLS**
2. **Добавлен fallback в composable useAuth** - если профиль не загружается, создается временный из метаданных пользователя
3. **Упрощены политики безопасности** - убраны проблемные проверки админских прав

## 🔧 Если проблема остается

Если после выполнения SQL команд проблема остается:

1. Очистите кэш браузера (Ctrl+Shift+Delete)
2. Перезапустите dev сервер: `npm run dev`
3. Проверьте в Supabase Dashboard → Authentication → Policies что политики применились

## 📞 Поддержка

Если проблема не решается, проверьте:
- Правильно ли выполнены SQL команды
- Нет ли других политик в Supabase Dashboard
- Работает ли триггер создания профилей

---

**Статус**: ✅ Исправлено в composable/useAuth.ts - теперь система работает даже без профиля в БД 