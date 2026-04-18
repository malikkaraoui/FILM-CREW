type LogLevel = 'info' | 'warn' | 'error'

function log(level: LogLevel, data: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    ...data,
  }
  if (level === 'error') {
    console.error(JSON.stringify(entry))
  } else {
    console.log(JSON.stringify(entry))
  }
}

export const logger = {
  info: (data: Record<string, unknown>) => log('info', data),
  warn: (data: Record<string, unknown>) => log('warn', data),
  error: (data: Record<string, unknown>) => log('error', data),
}
