-- Исправление политики RLS для таблицы bookings
-- Добавляем возможность менеджерам лодок видеть бронирования своих лодок

-- Удаляем старую политику
DROP POLICY IF EXISTS "Users can view their own bookings" ON bookings;

-- Создаем новую политику с поддержкой менеджеров лодок
CREATE POLICY "Users can view their own bookings" ON bookings
    FOR SELECT USING (
        -- Пользователь видит свои бронирования
        auth.uid() = user_id OR
        -- Анонимные бронирования видны всем (для создания)
        user_id IS NULL OR
        -- Администраторы видят все
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') OR
        -- Пользователи с ролью manager видят все
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager') OR
        -- Менеджеры конкретных лодок видят бронирования своих лодок
        EXISTS (
            SELECT 1 FROM boat_managers 
            WHERE user_id = auth.uid() AND boat_id = bookings.boat_id
        )
    );

-- Также обновляем политику для UPDATE операций
DROP POLICY IF EXISTS "Users can update their own bookings" ON bookings;

CREATE POLICY "Users can update their own bookings" ON bookings
    FOR UPDATE USING (
        -- Пользователь может обновлять свои бронирования
        auth.uid() = user_id OR
        -- Администраторы могут обновлять все
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') OR
        -- Пользователи с ролью manager могут обновлять все
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager') OR
        -- Менеджеры конкретных лодок могут обновлять бронирования своих лодок
        EXISTS (
            SELECT 1 FROM boat_managers 
            WHERE user_id = auth.uid() AND boat_id = bookings.boat_id
        )
    ); 