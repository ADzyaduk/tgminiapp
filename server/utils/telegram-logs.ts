/**
 * Простая система логирования для Telegram бота
 * Хранит последние логи в памяти для просмотра через команды
 */

interface LogEntry {
  timestamp: Date
  level: 'info' | 'warn' | 'error' | 'success'
  message: string
  data?: any
}

// Буфер для хранения логов (последние 100 записей)
const logBuffer: LogEntry[] = []
const MAX_LOGS = 100

/**
 * Добавляет лог в буфер
 */
export function addLog(level: LogEntry['level'], message: string, data?: any) {
  const entry: LogEntry = {
    timestamp: new Date(),
    level,
    message,
    data
  }

  logBuffer.push(entry)

  // Ограничиваем размер буфера
  if (logBuffer.length > MAX_LOGS) {
    logBuffer.shift()
  }
}

/**
 * Получает последние N логов
 */
export function getRecentLogs(count: number = 20): LogEntry[] {
  return logBuffer.slice(-count)
}

/**
 * Получает логи по уровню
 */
export function getLogsByLevel(level: LogEntry['level'], count: number = 20): LogEntry[] {
  return logBuffer
    .filter(log => log.level === level)
    .slice(-count)
}

/**
 * Получает логи за последние N минут
 */
export function getLogsByTime(minutes: number = 60): LogEntry[] {
  const cutoff = new Date(Date.now() - minutes * 60 * 1000)
  return logBuffer.filter(log => log.timestamp >= cutoff)
}

/**
 * Очищает буфер логов
 */
export function clearLogs() {
  logBuffer.length = 0
}

/**
 * Форматирует логи для отправки в Telegram
 */
export function formatLogsForTelegram(logs: LogEntry[], maxLength: number = 4000): string {
  if (logs.length === 0) {
    return '📋 Логов нет'
  }

  const emojiMap: Record<LogEntry['level'], string> = {
    info: 'ℹ️',
    warn: '⚠️',
    error: '❌',
    success: '✅'
  }

  let message = `📋 <b>Последние ${logs.length} логов:</b>\n\n`
  
  for (const log of logs) {
    const time = log.timestamp.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
    
    const emoji = emojiMap[log.level]
    const logLine = `${emoji} <b>[${time}]</b> ${log.message}\n`
    
    // Проверяем, не превысит ли сообщение лимит Telegram (4096 символов)
    if ((message + logLine).length > maxLength) {
      message += `\n... и еще ${logs.length - logs.indexOf(log)} записей`
      break
    }
    
    message += logLine
  }

  return message
}

