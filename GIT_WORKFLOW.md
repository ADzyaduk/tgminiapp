# Работа с Git и Pull Requests

## Как посмотреть Pull Request на GitHub

Pull Request (PR) создается на платформе GitHub, а не через git команды. Вот как это работает:

### 1. Проверьте, что было запушено

```bash
# Проверить статус
git status

# Посмотреть последние коммиты
git log --oneline -5

# Проверить, что есть на удаленном репозитории
git fetch origin
git log origin/master --oneline -5
```

### 2. Где посмотреть Pull Request на GitHub

1. Откройте ваш репозиторий: https://github.com/ADzyaduk/tgminiapp
2. Перейдите на вкладку **"Pull requests"** (вверху страницы)
3. Там будут все созданные Pull Requests

### 3. Как создать Pull Request

#### Вариант 1: Создать PR из текущей ветки (если вы пушили в master)

Если вы пушили изменения напрямую в `master`, то PR уже не нужен - изменения уже в основной ветке.

#### Вариант 2: Создать PR из отдельной ветки (рекомендуется)

1. **Создайте новую ветку:**
```bash
git checkout -b feature/optimizations
```

2. **Закоммитьте изменения:**
```bash
git add .
git commit -m "Оптимизация проекта: устранение дублирования, обновление зависимостей"
```

3. **Запушьте ветку:**
```bash
git push origin feature/optimizations
```

4. **Создайте Pull Request на GitHub:**
   - Откройте https://github.com/ADzyaduk/tgminiapp
   - GitHub автоматически предложит создать PR для новой ветки
   - Или перейдите в "Pull requests" → "New pull request"
   - Выберите `feature/optimizations` → `master`
   - Заполните описание и создайте PR

### 4. Проверить, что было запушено

```bash
# Сравнить локальную и удаленную ветки
git log master..origin/master

# Посмотреть все ветки
git branch -a

# Посмотреть последние коммиты на удаленном репозитории
git fetch origin
git log origin/master --oneline -10
```

## Текущий статус

Ваш репозиторий: https://github.com/ADzyaduk/tgminiapp

Если вы пушили изменения в `master`, они уже там. Pull Request нужен только если вы хотите:
- Создать отдельную ветку для изменений
- Сделать code review перед мерджем
- Обсудить изменения с командой

## Быстрые команды

```bash
# Проверить статус
git status

# Посмотреть последние коммиты
git log --oneline -5

# Запушить текущую ветку
git push origin master

# Создать новую ветку для PR
git checkout -b feature/my-changes
git push origin feature/my-changes
```


