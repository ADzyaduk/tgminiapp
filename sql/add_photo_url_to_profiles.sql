-- Добавляем поле photo_url в таблицу profiles для сохранения аватаров из Telegram
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Добавляем комментарий для документации
COMMENT ON COLUMN profiles.photo_url IS 'URL фотографии профиля из Telegram';

-- Создаем индекс для ускорения поиска (опционально, если планируется поиск по аватарам)
-- CREATE INDEX IF NOT EXISTS profiles_photo_url_idx ON profiles(photo_url) WHERE photo_url IS NOT NULL;
