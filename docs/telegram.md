# Telegram Bot: Webhook & Buttons Checklist

## Обязательные переменные окружения

- `TELEGRAM_BOT_TOKEN` – токен бота из BotFather. Без него любые запросы к Bot API будут проигнорированы.
- `TELEGRAM_WEBAPP_URL` – публичный HTTPS URL вашего Nuxt приложения. Используется в web‑app кнопках и fallback‑ссылках.
- `TELEGRAM_ADMIN_CHAT_ID` – чат администратора, куда падают уведомления, если нет менеджеров лодки.
- `TELEGRAM_USE_APP_LINKS` (опционально) – установите `true`, чтобы принудительно использовать URL‑кнопки вместо CallbackQuery.

## Как работают инлайн‑кнопки

1. Любое уведомление для менеджеров/админов собирается через `sendAdminNotification` и использует общий клиент `server/utils/telegram-client.ts`.
2. Callback payload строго соответствует формату `bookingType:action:bookingId` и автоматом ужимается до 64 байт.
3. Если `TELEGRAM_USE_APP_LINKS=true`, то вместо callback данных генерируются ссылки вида  
   `https://<WEBAPP_URL>/admin/bookings?action=confirm&id=<ID>&type=<TYPE>`.
4. Webhook (`/api/telegram/webhook`) парсит payload, валидирует поля и обновляет бронирования через Supabase.

## Настройка webhook

1. Убедитесь, что сервер доступен по HTTPS.
2. В админке откройте страницу `/admin/telegram-buttons` и:
   - укажите полный `https://domain/api/telegram/webhook`;
   - нажмите «Установить Webhook» (POST `/api/telegram/set-webhook`);
   - проверьте статус кнопкой «Проверить Webhook» (GET `/api/telegram/webhook-info`).
3. В логах сервера должно появиться подтверждение `Webhook setup result: ok`.

## Тестирование кнопок

1. Создайте бронирование в приложении и убедитесь, что у менеджера заполнен `telegram_id`.
2. Дождитесь уведомления в Telegram и нажмите «✅ Подтвердить» или «❌ Отменить`.
3. Проверьте:
   - статус записи в админке изменился;
   - исходное сообщение обновилось (кнопки исчезли, текст стал «ПОДТВЕРЖДЕНО/ОТМЕНЕНО»);
   - в консоли сервера есть лог `Booking <id> updated to ...`.
4. Если кнопки не работают:
   - убедитесь, что `TELEGRAM_BOT_TOKEN` валиден;
   - проверьте webhook через `/api/telegram/webhook-info`;
   - временно установите `TELEGRAM_USE_APP_LINKS=true`, чтобы использовать ссылочный fallback.

## Где смотреть логи

- **Локально:** терминал, где запущен `npm run dev`.
- **PM2:** `pm2 logs tgminiapp`.
- **Docker:** `docker logs <container>`.

Больше нет отдельных команд `/adminlogs` – все ошибки выводятся напрямую в консоль сервера.

## Быстрые команды для Bot API

```bash
# Проверить webhook
curl -X GET "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"

# Сбросить webhook
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/deleteWebhook"
```

Следуя чеклисту выше, можно быстро диагностировать любые проблемы с webhook или инлайн‑кнопками без старых отладочных команд.

