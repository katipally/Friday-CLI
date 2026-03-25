import chalk from 'chalk';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

let globalLevel: LogLevel = 'info';
let jsonMode = false;

export function setLogLevel(level: LogLevel): void {
  globalLevel = level;
}

export function setJsonMode(enabled: boolean): void {
  jsonMode = enabled;
}

export interface Logger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

export function createLogger(namespace: string): Logger {
  const shouldLog = (level: LogLevel): boolean => {
    return LOG_LEVELS[level] >= LOG_LEVELS[globalLevel];
  };

  const formatMessage = (level: LogLevel, message: string, data?: Record<string, unknown>): string => {
    if (jsonMode) {
      return JSON.stringify({ timestamp: new Date().toISOString(), level, namespace, message, ...data });
    }

    const prefix = chalk.gray(`[${namespace}]`);
    const levelColors: Record<string, (s: string) => string> = {
      debug: chalk.gray,
      info: chalk.blue,
      warn: chalk.yellow,
      error: chalk.red,
    };
    const colorFn = levelColors[level] || chalk.white;
    const levelTag = colorFn(level.toUpperCase().padEnd(5));
    const suffix = data ? chalk.gray(` ${JSON.stringify(data)}`) : '';
    return `${prefix} ${levelTag} ${message}${suffix}`;
  };

  return {
    debug(message, data) {
      if (shouldLog('debug')) console.debug(formatMessage('debug', message, data));
    },
    info(message, data) {
      if (shouldLog('info')) console.info(formatMessage('info', message, data));
    },
    warn(message, data) {
      if (shouldLog('warn')) console.warn(formatMessage('warn', message, data));
    },
    error(message, data) {
      if (shouldLog('error')) console.error(formatMessage('error', message, data));
    },
  };
}
