-- Альтернативная политика для системных обновлений (без Service Key)

-- Создаем специальную роль для системных операций
CREATE ROLE IF NOT EXISTS system_user;

-- Даем права на обновление бронирований для системной роли
GRANT UPDATE ON bookings TO system_user;

-- Создаем политику для системных обновлений
CREATE POLICY "System can update all bookings" ON bookings
    FOR UPDATE USING (
        -- Обычные пользователи (как раньше)
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')) OR
        EXISTS (
            SELECT 1 FROM boat_managers
            WHERE user_id = auth.uid() AND boat_id = bookings.boat_id
        ) OR
        -- Системные операции (без аутентификации, но с проверкой источника)
        (auth.uid() IS NULL AND current_setting('app.context', true) = 'telegram_webhook')
    );

-- Функция для установки контекста системной операции
CREATE OR REPLACE FUNCTION set_telegram_context()
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.context', 'telegram_webhook', true);
END;
$$ LANGUAGE plpgsql;
