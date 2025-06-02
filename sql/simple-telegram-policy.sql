-- Упрощенная политика для Telegram webhook (без Service Key)

-- Удаляем существующую политику UPDATE
DROP POLICY IF EXISTS "Users can update their own bookings" ON bookings;

-- Создаем новую политику с разрешением для неаутентифицированных системных операций
CREATE POLICY "Bookings update policy" ON bookings
    FOR UPDATE USING (
        -- Авторизованные пользователи (как раньше)
        (auth.uid() IS NOT NULL AND (
            auth.uid() = user_id OR
            EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')) OR
            EXISTS (
                SELECT 1 FROM boat_managers
                WHERE user_id = auth.uid() AND boat_id = bookings.boat_id
            )
        )) OR
        -- Системные операции без аутентификации (для Telegram webhook)
        auth.uid() IS NULL
    );

-- Также создаем политику для SELECT, чтобы системные операции могли читать данные
DROP POLICY IF EXISTS "Users can view their own bookings" ON bookings;

CREATE POLICY "Bookings select policy" ON bookings
    FOR SELECT USING (
        -- Авторизованные пользователи
        (auth.uid() IS NOT NULL AND (
            auth.uid() = user_id OR
            user_id IS NULL OR
            EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')) OR
            EXISTS (
                SELECT 1 FROM boat_managers
                WHERE user_id = auth.uid() AND boat_id = bookings.boat_id
            )
        )) OR
        -- Системные операции без аутентификации
        auth.uid() IS NULL
    );
