import { WinstonModule } from 'nest-winston';
import winston = require('winston');
import { format } from 'winston';

export const WINSTON_MODULE = WinstonModule.forRoot({
    transports: [
        new winston.transports.Console({
            format: format.combine(
                format.colorize(),
                format.timestamp(),
                format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`),
            ),
        }),
    ],
});