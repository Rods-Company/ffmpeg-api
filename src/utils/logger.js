const {createLogger, format, transports} = require('winston');
const {combine, timestamp, printf} = format;

const levelIcons = {
    error: '❌',
    warn: '⚠️',
    info: 'ℹ️',
    http: '🌐',
    verbose: '🔎',
    debug: '🛠️',
    silly: '🧪',
};

const logFormat = printf(function({level, message, timestamp}) {
    const icon = levelIcons[level] || '•';
    return `${timestamp} ${icon} ${level.toUpperCase()}: ${message}`;
});

module.exports = createLogger({
    format: combine(
        timestamp(),
        logFormat
    ),
    transports: [new transports.Console({
        level: process.env.LOG_LEVEL || 'info',
    })],
});
