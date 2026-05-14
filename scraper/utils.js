/**
 * @file utils.js
 * Utilidades para el scraper: User-Agents, pausas y logs.
 */

export const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1'
];

/**
 * Retorna un User-Agent aleatorio.
 */
export function getRandomUA() {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

/**
 * Pausa la ejecución un tiempo aleatorio entre min y max ms.
 */
export function sleep(min = 2000, max = 5000) {
  const ms = Math.floor(Math.random() * (max - min + 1) + min);
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Log con formato y timestamp.
 */
export function log(msg, type = 'info') {
  const ts = new Date().toLocaleTimeString();
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    warn: '\x1b[33m',
    error: '\x1b[31m',
    reset: '\x1b[0m'
  };
  console.log(`[${ts}] ${colors[type]}${msg}${colors.reset}`);
}
