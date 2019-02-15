import { Module, Inject } from '@nestjs/common';
import { ethers } from 'ethers';
import winston = require('winston');

import * as Account from '../resources/account.json';
import { getModuleMetadata } from './module.metadata';

const network = process.env.NETWORK || 'kovan';
const provider = ethers.getDefaultProvider(network);
const privateKey = Account.privateKey;
const wallet = new ethers.Wallet(privateKey, provider);

@Module(getModuleMetadata(wallet, network))
export class AppModule {
    constructor(
        @Inject('winston') logger: winston.Logger,
    ) {
        logger.info(`Application started with ${network} network`);
    }
}
