-- Схема базы данных для Boat Rental App

-- Таблица профилей
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    email TEXT UNIQUE,
    name TEXT,
    phone TEXT,
    avatar TEXT,
    role TEXT DEFAULT 'user', -- user, agent, manager, admin
    telegram_id TEXT,
    metadata JSONB
);

-- Таблица лодок
CREATE TABLE IF NOT EXISTS boats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL, -- Цена для обычных клиентов
    agent_price INTEGER NOT NULL, -- Цена для агентов
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tags TEXT[],
    specs JSONB, -- Характеристики (вместимость, мощность и т.д.)
    images TEXT[], -- URLs изображений
    location JSONB, -- Координаты и адрес
    owner_id UUID REFERENCES profiles(id),
    status TEXT DEFAULT 'active', -- active, maintenance, inactive
    metadata JSONB
);

-- Таблица менеджеров лодок (связь многие-ко-многим)
CREATE TABLE IF NOT EXISTS boat_managers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    boat_id UUID REFERENCES boats(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(boat_id, user_id)
);

-- Таблица бронирований
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    boat_id UUID REFERENCES boats(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id),
    guest_name TEXT NOT NULL,
    guest_note TEXT,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    price INTEGER NOT NULL, -- Общая цена бронирования
    pph INTEGER NOT NULL, -- Цена за час (Price Per Hour)
    prepayment INTEGER DEFAULT 0, -- Предоплата
    peoples INTEGER DEFAULT 1, -- Количество людей
    status TEXT DEFAULT 'pending', -- pending, confirmed, completed, cancelled
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB
);

-- Таблица уведомлений
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info', -- info, success, warning, error
    read BOOLEAN DEFAULT false,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица отзывов
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    boat_id UUID REFERENCES boats(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    text TEXT,
    response TEXT, -- Ответ от администратора
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица приглашений для регистрации
CREATE TABLE IF NOT EXISTS invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    role TEXT DEFAULT 'agent', -- agent, manager, admin
    used BOOLEAN DEFAULT false,
    used_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    usage_limit INTEGER DEFAULT 1,
    used_count INTEGER DEFAULT 0,
    note TEXT
);

-- Индексы
CREATE INDEX IF NOT EXISTS bookings_boat_id_idx ON bookings(boat_id);
CREATE INDEX IF NOT EXISTS bookings_user_id_idx ON bookings(user_id);
CREATE INDEX IF NOT EXISTS bookings_dates_idx ON bookings(start_time, end_time);
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS reviews_boat_id_idx ON reviews(boat_id);
CREATE INDEX IF NOT EXISTS reviews_user_id_idx ON reviews(user_id);
CREATE INDEX IF NOT EXISTS invites_code_idx ON invites(code);
CREATE INDEX IF NOT EXISTS boat_managers_boat_id_idx ON boat_managers(boat_id);
CREATE INDEX IF NOT EXISTS boat_managers_user_id_idx ON boat_managers(user_id);

-- Разрешения
-- public - все могут читать
ALTER TABLE boats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public boats are viewable by everyone" ON boats
    FOR SELECT USING (status = 'active');

-- Только авторизованные пользователи могут создавать бронирования
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create bookings" ON bookings
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
    
-- Пользователи видят только свои бронирования, администраторы и менеджеры видят все
CREATE POLICY "Users can view their own bookings" ON bookings
    FOR SELECT USING (
        auth.uid() = user_id OR 
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
    );

-- Уведомления видны только их получателям
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- Отзывы доступны всем для чтения
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can view reviews" ON reviews
    FOR SELECT USING (true);
    
-- Создавать отзывы могут только авторизованные пользователи
CREATE POLICY "Authenticated users can create reviews" ON reviews
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
    
-- Пользователи могут редактировать только свои отзывы
CREATE POLICY "Users can update their own reviews" ON reviews
    FOR UPDATE USING (auth.uid() = user_id);

-- Приглашения доступны только администраторам
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins can manage invites" ON invites
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Менеджеры лодок - только админы могут управлять
ALTER TABLE boat_managers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins can manage boat managers" ON boat_managers
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
CREATE POLICY "Everyone can view boat managers" ON boat_managers
    FOR SELECT USING (true);
    
-- Функции и триггеры
-- Обновление updated_at при изменении отзыва
CREATE OR REPLACE FUNCTION update_review_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_review_updated_at
BEFORE UPDATE ON reviews
FOR EACH ROW
EXECUTE FUNCTION update_review_updated_at();

CREATE OR REPLACE FUNCTION get_rating_counts_for_boat(boat_id_param UUID)
RETURNS TABLE(rating INTEGER, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.rating,
    COUNT(r.id)
  FROM
    reviews r
  WHERE
    r.boat_id = boat_id_param
  GROUP BY
    r.rating;
END;
$$ LANGUAGE plpgsql; 