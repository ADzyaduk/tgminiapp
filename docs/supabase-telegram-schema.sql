-- Добавление telegram_id к профилям пользователей
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS telegram_id TEXT UNIQUE;

-- Создание таблицы для хранения данных пользователей Telegram
CREATE TABLE IF NOT EXISTS telegram_users (
  telegram_id TEXT PRIMARY KEY,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Обновление таблицы бронирований
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

-- Создание таблицы для управления рассылками и уведомлениями
CREATE TABLE IF NOT EXISTS telegram_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL, -- 'booking_created', 'booking_confirmed', 'reminder', etc.
  user_id UUID REFERENCES auth.users(id),
  telegram_id TEXT,
  booking_id UUID REFERENCES bookings(id),
  content TEXT,
  sent_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Индексы для быстрой работы с уведомлениями
CREATE INDEX IF NOT EXISTS telegram_notifications_user_id_idx ON telegram_notifications(user_id);
CREATE INDEX IF NOT EXISTS telegram_notifications_telegram_id_idx ON telegram_notifications(telegram_id);
CREATE INDEX IF NOT EXISTS telegram_notifications_booking_id_idx ON telegram_notifications(booking_id);
CREATE INDEX IF NOT EXISTS telegram_notifications_status_idx ON telegram_notifications(status);

-- Политики доступа для безопасной работы с данными Telegram
ALTER TABLE telegram_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_notifications ENABLE ROW LEVEL SECURITY;

-- Базовые политики для пользователей
CREATE POLICY telegram_users_select ON telegram_users
  FOR SELECT USING (true); -- Все могут видеть

CREATE POLICY telegram_users_insert ON telegram_users
  FOR INSERT WITH CHECK (true); -- Все могут создавать записи

CREATE POLICY telegram_users_update ON telegram_users
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE telegram_id = telegram_users.telegram_id
    )
  ); -- Только владелец аккаунта может обновлять свои данные

-- Политики для уведомлений
CREATE POLICY notifications_admins ON telegram_notifications
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  ); -- Полный доступ для администраторов

CREATE POLICY notifications_user_select ON telegram_notifications
  FOR SELECT USING (
    auth.uid() = user_id
  ); -- Пользователи могут видеть только свои уведомления 