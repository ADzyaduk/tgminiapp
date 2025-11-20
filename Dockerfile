# Многослойная сборка для оптимизации размера образа
FROM node:18-alpine AS base

# Устанавливаем зависимости только для production
FROM base AS deps
WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Сборка приложения
FROM base AS builder
WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./
RUN npm ci

# Копируем исходный код
COPY . .

# Собираем приложение
RUN npm run build

# Production образ
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Создаем непривилегированного пользователя
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nuxtjs

# Копируем зависимости из deps
COPY --from=deps --chown=nuxtjs:nodejs /app/node_modules ./node_modules

# Копируем собранное приложение из builder
COPY --from=builder --chown=nuxtjs:nodejs /app/.output ./.output
COPY --from=builder --chown=nuxtjs:nodejs /app/package.json ./package.json

# Переключаемся на непривилегированного пользователя
USER nuxtjs

# Открываем порт
EXPOSE 3000

# Запускаем приложение
CMD ["node", ".output/server/index.mjs"]
