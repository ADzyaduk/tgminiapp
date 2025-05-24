-- ИСПРАВЛЕНИЕ ПОЛИТИК RLS ДЛЯ УСТРАНЕНИЯ РЕКУРСИИ

-- Удаляем все существующие политики
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- Временно отключаем RLS чтобы избежать проблем
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Создаем функцию для проверки админских прав без рекурсии
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Используем прямой запрос к auth.users для избежания рекурсии
  RETURN EXISTS (
    SELECT 1 
    FROM auth.users u
    WHERE u.id = auth.uid() 
    AND u.raw_user_meta_data->>'role' = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Создаем функцию для проверки роли пользователя через auth.users
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()),
    'user'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Включаем RLS обратно
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Создаем упрощенные политики без рекурсии

-- Пользователи могут видеть свой профиль
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Пользователи могут обновлять свой профиль  
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Политика вставки (для триггера)
CREATE POLICY "Enable insert for authenticated users" ON public.profiles
  FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Если нужны админские права, используйте отдельную функцию
-- или управляйте правами через Supabase Dashboard

-- Обновляем функцию создания пользователя чтобы сохранять роль
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, phone, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 