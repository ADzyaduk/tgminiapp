# Решение ошибки сборки в Amvera

## Быстрые решения

### Вариант 1: Упрощенная конфигурация (уже применена)

Я обновил `amvera.yaml` - теперь используется более простой формат:
- Убрал поле `install` (может не поддерживаться)
- Использую `npm install` вместо `npm ci` (на случай, если нет package-lock.json)
- Упростил структуру

**Что сделать:**
1. Закоммитьте изменения:
```bash
git add amvera.yaml
git commit -m "Исправление конфигурации Amvera"
git push
```

2. Проверьте логи сборки в панели Amvera

### Вариант 2: Использовать Dockerfile вместо amvera.yaml

Если `amvera.yaml` все еще не работает:

1. **Временно переименуйте amvera.yaml:**
```bash
git mv amvera.yaml amvera.yaml.backup
```

2. **Amvera автоматически использует Dockerfile** (он уже есть в проекте)

3. Закоммитьте:
```bash
git add .
git commit -m "Использование Dockerfile для сборки"
git push
```

### Вариант 3: Альтернативная конфигурация

Если нужен другой вариант, используйте `amvera-alternative.yaml`:

1. Переименуйте:
```bash
git mv amvera.yaml amvera.yaml.old
git mv amvera-alternative.yaml amvera.yaml
```

2. Закоммитьте и отправьте:
```bash
git add .
git commit -m "Альтернативная конфигурация Amvera"
git push
```

## Проверка логов

**Важно:** Посмотрите логи сборки в панели Amvera:

1. Откройте ваше приложение в Amvera
2. Перейдите в **«Лог сборки»** или **«Build Logs»**
3. Нажмите **«Загрузить историю»** или **«Download History»**
4. Найдите конкретную ошибку

## Частые ошибки и решения

### Ошибка: "npm ci failed" или "package-lock.json not found"

**Решение:** Используйте `npm install` вместо `npm ci` (уже исправлено в новом amvera.yaml)

### Ошибка: "Cannot find module" или "Missing dependencies"

**Решение:**
1. Убедитесь, что `package.json` находится в корне проекта
2. Проверьте, что все зависимости указаны в `package.json`
3. Попробуйте удалить `node_modules` и `package-lock.json` локально, затем:
```bash
npm install
git add package-lock.json
git commit -m "Обновление package-lock.json"
git push
```

### Ошибка: "Command failed" или "Build timeout"

**Решение:**
1. Проверьте, что команда `npm run build` работает локально
2. Возможно, нужен более высокий тариф (больше памяти/времени)
3. Попробуйте упростить процесс сборки

### Ошибка: "Nuxt not found" или "Cannot find nuxt"

**Решение:**
1. Убедитесь, что `nuxt` указан в `dependencies` (не только в `devDependencies`)
2. Проверьте, что `nuxt.config.ts` находится в корне проекта

### Ошибка: "Out of memory" или "Killed"

**Решение:**
- Выберите более высокий тарифный план в Amvera
- Или оптимизируйте сборку (уменьшите размер зависимостей)

## Пошаговая диагностика

### 1. Проверьте локально

Убедитесь, что сборка работает локально:

```bash
# Очистка
rm -rf node_modules .output .nuxt package-lock.json

# Установка
npm install

# Сборка
npm run build

# Проверка
ls -la .output/server/index.mjs
```

Если локально не работает - исправьте проблемы сначала.

### 2. Проверьте файлы в Git

Убедитесь, что все нужные файлы закоммичены:

```bash
git status
git ls-files | grep -E "(package.json|nuxt.config|amvera.yaml|Dockerfile)"
```

### 3. Проверьте .gitignore

Убедитесь, что важные файлы не игнорируются:

```bash
cat .gitignore
```

Важно: `.output`, `.nuxt`, `node_modules` должны быть в `.gitignore`, но `package.json`, `nuxt.config.ts`, `amvera.yaml` - НЕ должны.

## Если ничего не помогает

1. **Посмотрите точную ошибку в логах Amvera** - это самое важное!
2. **Скопируйте текст ошибки** и отправьте мне
3. **Попробуйте использовать Dockerfile** вместо amvera.yaml
4. **Обратитесь в поддержку Amvera** с логами сборки

## Контакты

- Поддержка Amvera: support@amvera.ru
- Документация: https://docs.amvera.ru/

