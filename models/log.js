process.stdout.isTTY = true; //Fix for WebStorm to show colors in terminal
const config = require('../config'),
    log4js = require('log4js');

log4js.configure({
    appenders: {
        out: {
            type: 'stdout',
            layout: {
                type: 'pattern',
                pattern: '[%d{dd.MM.yyyy hh:mm:ss}]%[[%p] %m%]',
            }
        },
        nodebug: {
            type: 'logLevelFilter',
            appender: 'out',
            level: 'info'
        },
        app: {
            type: 'file',
            filename: config.logging.file,
            layout: {
                type: 'pattern',
                pattern: '[%d{dd.MM.yyyy hh:mm:ss:SSS}][%p] %m',
            }
        }
    },
    categories: {
        default: {
            appenders: [(config.logging.debug ? 'out' : 'nodebug'), 'app'],
            level: 'debug'
        }
    }
});
const logger = log4js.getLogger();

module.exports = logger;