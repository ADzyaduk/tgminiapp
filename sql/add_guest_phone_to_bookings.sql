-- Добавляем поле guest_phone в таблицу bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guest_phone TEXT; 