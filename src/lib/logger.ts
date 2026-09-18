type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const minLevel = (process.env.LOG_LEVEL as Level) || 'info';

function log(level: Level, message: string, context: Record<string, unknown> = {}) {
  if (LEVELS[level] < (LEVELS[minLevel] ?? LEVELS.info)) return;
  if (process.env.NODE_ENV === 'test' && level !== 'error') return;

  const line = JSON.stringify({ level, message, timestamp: new Date().toISOString(), ...context });
  if (level === 'error') console.error(line);
  else console.log(line);
}

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => log('debug', msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => log('info', msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => log('warn', msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => log('error', msg, ctx),
};
