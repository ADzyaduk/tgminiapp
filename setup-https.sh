#!/bin/bash

# Цвета для красивого вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Настройка HTTPS для Nuxt приложения ===${NC}"
echo ""

# Проверка, что скрипт запущен от root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Пожалуйста, запустите скрипт от root: sudo ./setup-https.sh${NC}"
    exit 1
fi

# Запрос домена
echo -e "${YELLOW}Введите ваш домен (например: example.com):${NC}"
read DOMAIN

if [ -z "$DOMAIN" ]; then
    echo -e "${RED}Домен не может быть пустым!${NC}"
    exit 1
fi

echo -e "${GREEN}Домен: $DOMAIN${NC}"
echo ""

# Шаг 1: Обновление пакетов
echo -e "${GREEN}1. Обновление системы...${NC}"
apt update && apt upgrade -y

# Шаг 2: Установка Certbot
echo -e "${GREEN}2. Установка Certbot...${NC}"
apt install -y certbot python3-certbot-nginx

# Шаг 3: Проверка Nginx конфигурации
echo -e "${GREEN}3. Проверка конфигурации Nginx...${NC}"
if ! nginx -t; then
    echo -e "${RED}Ошибка в конфигурации Nginx!${NC}"
    exit 1
fi

# Шаг 4: Создание улучшенной конфигурации Nginx
echo -e "${GREEN}4. Создание конфигурации Nginx для $DOMAIN...${NC}"
cat > /etc/nginx/sites-available/$DOMAIN << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    # Временная конфигурация для получения сертификата
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Включение сайта
if [ ! -L /etc/nginx/sites-enabled/$DOMAIN ]; then
    ln -s /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
fi

# Удаление default конфигурации если существует
if [ -L /etc/nginx/sites-enabled/default ]; then
    rm /etc/nginx/sites-enabled/default
fi

# Перезапуск Nginx
systemctl reload nginx

# Шаг 5: Получение SSL сертификата
echo -e "${GREEN}5. Получение SSL сертификата...${NC}"
echo -e "${YELLOW}Certbot запросит email и согласие с условиями использования${NC}"
echo ""

certbot --nginx -d $DOMAIN -d www.$DOMAIN

# Шаг 6: Проверка автоматического обновления
echo -e "${GREEN}6. Настройка автоматического обновления сертификата...${NC}"
systemctl enable certbot.timer
systemctl start certbot.timer

# Шаг 7: Создание улучшенной HTTPS конфигурации
echo -e "${GREEN}7. Создание оптимизированной HTTPS конфигурации...${NC}"
cat > /etc/nginx/sites-available/$DOMAIN << EOF
# HTTP -> HTTPS редирект
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    return 301 https://\$host\$request_uri;
}

# HTTPS конфигурация
server {
    listen 443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;

    # SSL настройки (добавит Certbot)
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Безопасность
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Проксирование к Nuxt приложению
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Таймауты
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Сжатие
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
}
EOF

# Перезапуск Nginx
nginx -t && systemctl reload nginx

echo ""
echo -e "${GREEN}=== HTTPS успешно настроен! ===${NC}"
echo -e "${GREEN}Ваш сайт доступен по адресу: https://$DOMAIN${NC}"
echo ""
echo -e "${YELLOW}Не забудьте:${NC}"
echo -e "1. Обновить DNS записи домена на IP вашего VPS"
echo -e "2. В nuxt.config.ts вернуть: secure: process.env.NODE_ENV === 'production'"
echo -e "3. Перезапустить ваше Nuxt приложение"
echo ""
echo -e "${GREEN}Проверка сертификата: certbot certificates${NC}"
echo -e "${GREEN}Тест обновления: certbot renew --dry-run${NC}" 