# Build Stage 1

FROM node:22-alpine AS build
WORKDIR /app

# Copy package.json and lockfile
COPY package*.json ./

# Install dependencies (including optional for native bindings)
RUN npm ci --include=optional

# Copy the entire project
COPY . ./

# ARG для переменных окружения во время сборки
# Эти переменные нужны для компиляции клиентского кода при ssr: false
ARG SUPABASE_URL
ARG SUPABASE_KEY
ARG SUPABASE_ANON_KEY
ARG SUPABASE_SERVICE_KEY
ARG TELEGRAM_BOT_TOKEN
ARG JWT_SECRET
ARG JWT_REFRESH_SECRET
ARG DISABLE_REALTIME

# Устанавливаем переменные окружения для сборки
# Поддерживаем оба варианта имен для Supabase ключа
ENV SUPABASE_URL=${SUPABASE_URL}
ENV SUPABASE_KEY=${SUPABASE_KEY}
ENV SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY:-${SUPABASE_KEY}}
ENV SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
ENV TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
ENV JWT_SECRET=${JWT_SECRET}
ENV JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
ENV DISABLE_REALTIME=${DISABLE_REALTIME}
ENV NODE_ENV=production

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
# Но можно также использовать ARG для передачи во время сборки (опционально)
# ARG SUPABASE_URL
# ARG SUPABASE_KEY
# ENV SUPABASE_URL=${SUPABASE_URL}
# ENV SUPABASE_KEY=${SUPABASE_KEY}

EXPOSE 80

CMD ["node", ".output/server/index.mjs"]
