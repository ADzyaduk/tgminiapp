# Инструкция по деплою в облако

## Быстрый старт с Docker Compose

### 1. Подготовка

1. Скопируйте `.env.example` в `.env`:
```bash
cp .env.example .env
```

2. Заполните все переменные окружения в `.env`:
   - `SUPABASE_URL` - URL вашего проекта Supabase
   - `SUPABASE_KEY` - Anon key из Supabase
   - `SUPABASE_SERVICE_KEY` - Service Role key из Supabase
   - `JWT_SECRET` - JWT секрет из Supabase
   - `JWT_REFRESH_SECRET` - Refresh секрет (или оставьте пустым)
   - `TELEGRAM_BOT_TOKEN` - Токен вашего Telegram бота
   - `TELEGRAM_WEBAPP_URL` - URL вашего приложения (например: https://your-domain.com)
   - `TELEGRAM_ADMIN_CHAT_ID` - ID чата администратора

### 2. Запуск с Docker Compose

```bash
# Сборка и запуск
docker-compose up -d --build

# Просмотр логов
docker-compose logs -f

# Остановка
docker-compose down
```

Приложение будет доступно по адресу `http://your-server-ip:80`

### 3. Настройка домена и HTTPS (опционально)

#### Вариант A: Использование Docker Compose с Nginx

1. Обновите `nginx.conf`:
   - Раскомментируйте HTTPS секцию
   - Замените `your-domain.com` на ваш домен
   - Настройте SSL сертификаты

2. Получите SSL сертификат (Let's Encrypt):
```bash
# Установите certbot
sudo apt install certbot

# Получите сертификат
sudo certbot certonly --standalone -d your-domain.com

# Скопируйте сертификаты в папку nginx/ssl
mkdir -p nginx/ssl
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/
```

3. Обновите `nginx.conf` с правильными путями к сертификатам

4. Перезапустите контейнеры:
```bash
docker-compose restart nginx
```

#### Вариант B: Использование внешнего Nginx на хосте

Если у вас уже установлен Nginx на сервере, используйте скрипт `setup-https.sh`:

```bash
sudo ./setup-https.sh
```

Этот скрипт:
- Настроит Nginx на хосте
- Получит SSL сертификат через Certbot
- Настроит проксирование на Docker контейнер

## Деплой без Docker Compose (только приложение)

### 1. Сборка Docker образа

```bash
docker build -t nuxt-telegram-app .
```

### 2. Запуск контейнера

```bash
docker run -d \
  --name nuxt-telegram-app \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file .env \
  nuxt-telegram-app
```

### 3. Настройка Nginx на хосте

Используйте `nginx.conf` как пример для настройки Nginx на хосте, или используйте `setup-https.sh`.

## Деплой с PM2 (без Docker)

Если вы предпочитаете запускать приложение напрямую на сервере:

1. Установите зависимости:
```bash
npm ci --production
```

2. Соберите приложение:
```bash
npm run build
```

3. Установите PM2:
```bash
npm install -g pm2
```

4. Запустите с PM2:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

5. Настройте Nginx (используйте `nginx.conf` или `setup-https.sh`)

## Облачные платформы

### Amvera Cloud (рекомендуется для России)

Amvera Cloud поддерживает деплой через Git. В проекте уже настроен файл `amvera.yaml`.

#### Шаг 1: Создание приложения в Amvera

1. Зарегистрируйтесь на [Amvera Cloud](https://amvera.ru)
2. Создайте новое приложение
3. Выберите способ деплоя: **Git репозиторий**

#### Шаг 2: Подключение Git репозитория

**Вариант A: Использование репозитория Amvera**

1. В панели управления Amvera перейдите во вкладку «Репозиторий»
2. Скопируйте URL репозитория (например: `https://git.amvera.ru/username/project-name`)
3. Добавьте remote в ваш локальный репозиторий:
```bash
git remote add amvera https://git.amvera.ru/username/project-name
```

4. Отправьте код:
```bash
git push amvera master
```

**Вариант B: Подключение GitHub/GitLab/Bitbucket**

1. В панели управления Amvera перейдите в настройки приложения
2. Выберите «Подключить репозиторий»
3. Авторизуйтесь через GitHub/GitLab/Bitbucket
4. Выберите ваш репозиторий
5. Amvera автоматически начнет деплой при каждом push

#### Шаг 3: Настройка переменных окружения

В панели управления Amvera перейдите в раздел «Переменные окружения» и добавьте:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
JWT_SECRET=your-jwt-secret-here
JWT_REFRESH_SECRET=your-refresh-secret-key-here
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_WEBAPP_URL=https://your-app.amvera.app
TELEGRAM_ADMIN_CHAT_ID=your_admin_chat_id
DISABLE_REALTIME=false
NODE_ENV=production
```

**Важно**: После добавления переменных окружения приложение автоматически перезапустится.

#### Шаг 4: Проверка деплоя

1. После успешного деплоя приложение будет доступно по адресу: `https://your-app.amvera.app`
2. Проверьте логи в панели управления Amvera
3. Обновите `TELEGRAM_WEBAPP_URL` на реальный URL вашего приложения

#### Настройка кастомного домена (опционально)

1. В панели управления Amvera перейдите в «Домены»
2. Добавьте ваш домен
3. Настройте DNS записи согласно инструкциям Amvera
4. Обновите `TELEGRAM_WEBAPP_URL` на ваш кастомный домен

#### Автоматический деплой

Amvera автоматически деплоит приложение при каждом push в основную ветку (master/main).

### Vercel / Netlify

Эти платформы автоматически определяют Nuxt приложения. Просто подключите репозиторий и настройте переменные окружения в панели управления.

### Railway / Render

1. Подключите репозиторий
2. Настройте переменные окружения
3. Укажите команду сборки: `npm run build`
4. Укажите команду запуска: `npm start`

### DigitalOcean App Platform

1. Создайте новое приложение из репозитория
2. Выберите тип: Node.js
3. Настройте переменные окружения
4. Build Command: `npm run build`
5. Run Command: `npm start`

### AWS / Google Cloud / Azure

Используйте Docker Compose или создайте Kubernetes манифесты на основе `docker-compose.yml`.

## Проверка работоспособности

После деплоя проверьте:

1. Приложение доступно: `curl http://your-domain.com`
2. Health check: `curl http://your-domain.com/api/health` (если настроен)
3. Логи контейнера: `docker-compose logs app`
4. Логи Nginx: `docker-compose logs nginx`

## Обновление приложения

```bash
# Остановите контейнеры
docker-compose down

# Получите последние изменения
git pull

# Пересоберите и запустите
docker-compose up -d --build
```

## Полезные команды

```bash
# Просмотр логов
docker-compose logs -f app

# Перезапуск приложения
docker-compose restart app

# Вход в контейнер
docker-compose exec app sh

# Просмотр использования ресурсов
docker stats

# Очистка неиспользуемых образов
docker system prune -a
```

## Troubleshooting

### Приложение не запускается

1. Проверьте логи: `docker-compose logs app`
2. Убедитесь, что все переменные окружения установлены
3. Проверьте, что порт 3000 не занят другим процессом

### Nginx не проксирует запросы

1. Проверьте логи Nginx: `docker-compose logs nginx`
2. Убедитесь, что имя сервиса в `nginx.conf` совпадает с именем в `docker-compose.yml` (должно быть `app`)
3. Проверьте, что приложение запущено: `docker-compose ps`

### Проблемы с SSL

1. Убедитесь, что домен указывает на IP сервера
2. Проверьте, что порты 80 и 443 открыты в firewall
3. Проверьте сертификаты: `certbot certificates`

