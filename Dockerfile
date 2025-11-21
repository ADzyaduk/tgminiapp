# Build Stage 1

FROM node:22-alpine AS build
WORKDIR /app

# Copy package.json and lockfile
COPY package*.json ./

# Install dependencies (including optional for native bindings)
RUN npm ci --include=optional

# Copy the entire project
COPY . ./

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
