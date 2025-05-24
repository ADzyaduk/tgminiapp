# Настройка HTTPS для Nuxt приложения на VPS

## Автоматическая настройка

**Быстрый способ:**
```bash
chmod +x setup-https.sh
sudo ./setup-https.sh
```

---

## Ручная настройка (пошагово)

### Предварительные требования
- Домен направлен на IP вашего VPS
- Nginx установлен и запущен
- Порт 80 и 443 открыты в файрволе

### Шаг 1: Установка Certbot
```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx
```

### Шаг 2: Проверка DNS
Убедитесь, что ваш домен указывает на VPS:
```bash
dig yourdomain.com
nslookup yourdomain.com
```

### Шаг 3: Настройка Nginx конфигурации
Создайте файл `/etc/nginx/sites-available/yourdomain.com`:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Шаг 4: Включение сайта
```bash
sudo ln -s /etc/nginx/sites-available/yourdomain.com /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default  # удалить если есть
sudo nginx -t
sudo systemctl reload nginx
```

### Шаг 5: Получение SSL сертификата
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Certbot:
- Запросит email для уведомлений
- Попросит согласиться с условиями
- Автоматически обновит конфигурацию Nginx

### Шаг 6: Проверка автообновления
```bash
sudo systemctl status certbot.timer
sudo certbot renew --dry-run
```

---

## После настройки HTTPS

### 1. Обновить Nuxt конфигурацию
В `nuxt.config.ts` вернуть:
```typescript
supabase: {
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production', // Теперь будет работать!
  }
}
```

### 2. Перезапустить приложение
```bash
./deploy.sh
```

### 3. Проверить работу
- Откройте https://yourdomain.com
- Проверьте, что сессия сохраняется при обновлении
- Убедитесь, что HTTP редиректит на HTTPS

---

## Диагностика проблем

### Проверка статуса сертификата
```bash
sudo certbot certificates
```

### Проверка Nginx
```bash
sudo nginx -t
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log
```

### Проверка портов
```bash
sudo netstat -tlnp | grep :443
sudo ufw status
```

### Проверка DNS
```bash
dig yourdomain.com
nslookup yourdomain.com
```

---

## Полезные команды

```bash
# Обновление сертификата вручную
sudo certbot renew

# Проверка конфигурации SSL
openssl s_client -connect yourdomain.com:443

# Проверка рейтинга SSL
# Откройте: https://www.ssllabs.com/ssltest/

# Логи Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

## Решение частых проблем

### "Domain doesn't point to this server"
- Проверьте DNS записи
- Подождите до 48 часов для распространения DNS

### "Port 80 blocked"
```bash
sudo ufw allow 80
sudo ufw allow 443
```

### Сертификат не обновляется
```bash
sudo systemctl status certbot.timer
sudo systemctl start certbot.timer
```

### Nginx не запускается
```bash
sudo nginx -t  # проверить синтаксис
sudo systemctl status nginx
``` 