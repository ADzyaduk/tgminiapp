# Многослойная сборка для оптимизации размера образа
# Используем node:20 вместо node:20-alpine для совместимости с native bindings
FROM node:20 AS base

# Устанавливаем зависимости только для production
FROM base AS deps
WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./
# Используем --omit=dev вместо --only=production (более новый синтаксис)
# И устанавливаем optional dependencies для native bindings
RUN npm ci --omit=dev --include=optional && npm cache clean --force

# Сборка приложения
FROM base AS builder
WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./
# Устанавливаем все зависимости включая optional для native bindings
RUN npm ci --include=optional

# Копируем исходный код
COPY . .

# Собираем приложение
RUN npm run build

# Production образ
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
# PORT будет установлен Amvera через переменную окружения
# По умолчанию используем 3000, но Amvera может установить свой порт
ENV PORT=3000

# Копируем зависимости из deps
COPY --from=deps /app/node_modules ./node_modules

# Копируем собранное приложение из builder
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json ./package.json

# Проверяем, что файлы на месте (для диагностики)
RUN ls -la .output/server/ || echo "ERROR: .output/server not found" && \
    test -f .output/server/index.mjs || echo "ERROR: index.mjs not found"

# Открываем порт
EXPOSE 3000

# Запускаем приложение
# Используем exec form для правильной обработки сигналов
CMD ["node", ".output/server/index.mjs"]
