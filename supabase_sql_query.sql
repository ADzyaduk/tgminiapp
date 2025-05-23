-- Таблица групповых поездок
CREATE TABLE IF NOT EXISTS group_trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    boat_id UUID REFERENCES boats(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    adult_price INTEGER NOT NULL, -- Цена для взрослого (например 2000 руб)
    child_price INTEGER NOT NULL, -- Цена для ребенка (например 1200 руб)
    total_seats INTEGER NOT NULL, -- Общее количество мест
    available_seats INTEGER NOT NULL, -- Доступное количество мест
    status TEXT DEFAULT 'scheduled', -- scheduled, in_progress, completed, cancelled
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    metadata JSONB
);

-- Таблица бронирований на групповые поездки
CREATE TABLE IF NOT EXISTS group_trip_bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_trip_id UUID REFERENCES group_trips(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id),
    guest_name TEXT NOT NULL,
    guest_phone TEXT,
    adult_count INTEGER DEFAULT 0, -- Количество взрослых
    child_count INTEGER DEFAULT 0, -- Количество детей
    total_price INTEGER NOT NULL, -- Общая цена бронирования
    status TEXT DEFAULT 'confirmed', -- confirmed, completed, cancelled
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    metadata JSONB
);

-- Индексы
CREATE INDEX IF NOT EXISTS group_trips_boat_id_idx ON group_trips(boat_id);
CREATE INDEX IF NOT EXISTS group_trips_dates_idx ON group_trips(start_time, end_time);
CREATE INDEX IF NOT EXISTS group_trip_bookings_trip_id_idx ON group_trip_bookings(group_trip_id);
CREATE INDEX IF NOT EXISTS group_trip_bookings_user_id_idx ON group_trip_bookings(user_id);

-- Разрешения
ALTER TABLE group_trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Group trips are viewable by everyone" ON group_trips
    FOR SELECT USING (status IN ('scheduled', 'in_progress'));

-- Только менеджеры и админы могут создавать групповые поездки
CREATE POLICY "Managers can create group trips" ON group_trips
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'manager')
        ) OR
        EXISTS (
            SELECT 1 FROM boat_managers 
            WHERE user_id = auth.uid() AND boat_id = NEW.boat_id
        )
    );

-- Менеджеры могут обновлять информацию о групповых поездках
CREATE POLICY "Managers can update group trips" ON group_trips
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'manager')
        ) OR
        EXISTS (
            SELECT 1 FROM boat_managers 
            WHERE user_id = auth.uid() AND boat_id = boat_id
        )
    );

-- Бронирования на групповые поездки
ALTER TABLE group_trip_bookings ENABLE ROW LEVEL SECURITY;

-- Все могут просматривать бронирования на групповые поездки (чтобы видеть количество мест)
CREATE POLICY "Everyone can view group trip bookings" ON group_trip_bookings
    FOR SELECT USING (true);

-- Авторизованные пользователи могут создавать бронирования
CREATE POLICY "Authenticated users can create group trip bookings" ON group_trip_bookings
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Пользователи видят только свои бронирования, администраторы и менеджеры видят все
CREATE POLICY "Users can update their own group trip bookings" ON group_trip_bookings
    FOR UPDATE USING (
        auth.uid() = user_id OR 
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
    );

-- Функция для обновления доступных мест при создании бронирования
CREATE OR REPLACE FUNCTION update_available_seats()
RETURNS TRIGGER AS $$
BEGIN
    -- Обновляем количество доступных мест
    UPDATE group_trips
    SET available_seats = available_seats - (NEW.adult_count + NEW.child_count)
    WHERE id = NEW.group_trip_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для обновления доступных мест при создании бронирования
CREATE TRIGGER trigger_update_available_seats
AFTER INSERT ON group_trip_bookings
FOR EACH ROW
EXECUTE FUNCTION update_available_seats();

-- Функция для восстановления доступных мест при отмене бронирования
CREATE OR REPLACE FUNCTION restore_available_seats()
RETURNS TRIGGER AS $$
BEGIN
    -- Восстанавливаем количество доступных мест при отмене или удалении бронирования
    IF OLD.status != 'cancelled' AND (TG_OP = 'DELETE' OR NEW.status = 'cancelled') THEN
        UPDATE group_trips
        SET available_seats = available_seats + (OLD.adult_count + OLD.child_count)
        WHERE id = OLD.group_trip_id;
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Триггеры для восстановления доступных мест
CREATE TRIGGER trigger_restore_seats_on_update
BEFORE UPDATE ON group_trip_bookings
FOR EACH ROW
WHEN (OLD.status != 'cancelled' AND NEW.status = 'cancelled')
EXECUTE FUNCTION restore_available_seats();

CREATE TRIGGER trigger_restore_seats_on_delete
BEFORE DELETE ON group_trip_bookings
FOR EACH ROW
EXECUTE FUNCTION restore_available_seats(); 