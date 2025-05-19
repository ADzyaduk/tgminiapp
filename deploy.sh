#!/bin/bash

# Проверяем, установлен ли Docker
if ! command -v docker &> /dev/null; then
    echo "Docker не установлен. Установите Docker перед запуском."
    exit 1
fi

# Проверяем, установлен ли Nginx
if ! command -v nginx &> /dev/null; then
    echo "Nginx не установлен. Установите Nginx перед запуском."
    exit 1
fi

# Останавливаем предыдущий контейнер, если существует
if docker ps -a | grep -q nuxt-app; then
    echo "Останавливаем предыдущий контейнер..."
    docker stop nuxt-app
    docker rm nuxt-app
fi

# Собираем новый образ
echo "Собираем Docker образ..."
docker build -t nuxt-telegram-app .

# Запускаем контейнер
echo "Запускаем контейнер..."
docker run -d -p 3000:3000 --name nuxt-app --restart unless-stopped nuxt-telegram-app

# Проверяем статус
echo "Проверяем, запущен ли контейнер..."
if docker ps | grep -q nuxt-app; then
    echo "Контейнер успешно запущен! Доступен по адресу http://localhost:3000"
    echo "Не забудьте настроить Nginx для проксирования на этот порт."
else
    echo "Что-то пошло не так. Проверьте логи: docker logs nuxt-app"
fi 