# Build Stage 1

FROM node:22-alpine AS build
WORKDIR /app

# Copy package.json and lockfile
COPY package*.json ./

# Install dependencies (including optional for native bindings)
RUN npm ci --include=optional

# Copy the entire project
COPY . ./

# Устанавливаем NODE_ENV для сборки
ENV NODE_ENV=production

# При SSR переменные окружения не нужны во время сборки
# Они будут доступны во время выполнения через Amvera Cloud
# Build the project
RUN npm run build

# Build Stage 2

FROM node:22-alpine
WORKDIR /app

# Only `.output` folder is needed from the build stage
COPY --from=build /app/.output ./.output

# Проверяем, что файлы на месте (для диагностики)
RUN echo "=== Checking build output ===" && \
    ls -la .output/ && \
    ls -la .output/server/ 2>/dev/null || echo "WARNING: .output/server not found" && \
    test -f .output/server/index.mjs && echo "✅ index.mjs found" || echo "❌ ERROR: index.mjs not found" && \
    find .output -name "*.mjs" -type f 2>/dev/null | head -10 && \
    echo "=== Build output check complete ==="

# Change the port and host
ENV PORT=80
ENV HOST=0.0.0.0
ENV NODE_ENV=production

# Переменные окружения будут установлены Amvera через панель управления
# При SSR они доступны во время выполнения через process.env
# Необходимые переменные:
# - SUPABASE_URL
# - SUPABASE_KEY (или SUPABASE_ANON_KEY)
# - SUPABASE_SERVICE_KEY
# - TELEGRAM_BOT_TOKEN
# - JWT_SECRET
# - JWT_REFRESH_SECRET
# - DISABLE_REALTIME (опционально)

EXPOSE 80

CMD ["node", ".output/server/index.mjs"]
