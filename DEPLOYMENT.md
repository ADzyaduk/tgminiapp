# Руководство по развертыванию Nuxt Mini App в Telegram

## 1. Подготовка VPS сервера

### Установка необходимого ПО

```bash
# Обновляем систему
sudo apt update && sudo apt upgrade -y

# Устанавливаем Nginx
sudo apt install nginx -y

# Устанавливаем Docker
sudo apt install docker.io -y
sudo systemctl enable docker
sudo systemctl start docker

# Устанавливаем Certbot для SSL
sudo apt install certbot python3-certbot-nginx -y
```

### Настройка Nginx

1. Загрузите конфигурацию Nginx на сервер:
```bash
sudo nano /etc/nginx/sites-available/your-domain.conf
# Вставьте содержимое файла nginx.conf из вашего проекта
```

2. Включите конфигурацию:
```bash
sudo ln -s /etc/nginx/sites-available/your-domain.conf /etc/nginx/sites-enabled/
sudo nginx -t  # Проверка конфигурации
sudo systemctl reload nginx
```

3. Настройте SSL (HTTPS обязателен для Telegram Mini App):
```bash
sudo certbot --nginx -d your-domain.com
```

## 2. Развертывание приложения

### Использование Docker

1. Клонируйте репозиторий на VPS:
```bash
git clone https://github.com/your-username/your-repo.git
cd your-repo
```

2. Соберите и запустите Docker-контейнер:
```bash
docker build -t nuxt-telegram-app .
docker run -d -p 3000:3000 --name nuxt-app nuxt-telegram-app
```

## 3. Интеграция с Telegram Bot API

1. Создайте нового бота через [@BotFather](https://t.me/BotFather) в Telegram
2. Получите токен бота
3. Настройте меню бота для добавления кнопки веб-приложения:

```
/setmenubutton
```

4. Введите URL вашего приложения (должен быть HTTPS):
```
https://your-domain.com
```

## 4. Тестирование

1. Откройте вашего бота в Telegram
2. Нажмите на кнопку веб-приложения
3. Ваше приложение должно открыться в Telegram Mini App

## 5. Устранение проблем

### Приложение не отображается или ошибки в консоли
- Проверьте, что URL имеет HTTPS
- Убедитесь, что бот имеет корректный токен
- Проверьте логи приложения: `docker logs nuxt-app`

### Приложение отображается некорректно
- Проверьте, что window.Telegram.WebApp доступен в приложении
- Убедитесь, что вызван метод `ready()` после загрузки приложения

## 6. Ссылки на документацию
- [Telegram Mini Apps Documentation](https://core.telegram.org/bots/webapps)
- [Bot API Documentation](https://core.telegram.org/bots/api)
- [Nuxt.js Documentation](https://nuxt.com/docs) 