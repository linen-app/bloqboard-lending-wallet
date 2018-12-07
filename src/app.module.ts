import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { CompoundService } from './compound.service';
import { TokenService } from './token.service';
import { ethers } from 'ethers';
import { TokenMetadata } from './types';
import * as Compound from '../resources/money-market.json';

const provider = ethers.getDefaultProvider('rinkeby');
const privateKey = require('../resources/account.json').privateKey;
const wallet = new ethers.Wallet(privateKey, provider);

const moneyMarketContract = new ethers.Contract(
    Compound.networks[4].address,
    Compound.abi,
    wallet,
);
const moneyMarketContractProvider = {
    provide: 'money-market-contract',
    useValue: moneyMarketContract,
};

const walletProvider = {
    provide: 'wallet',
    useValue: wallet,
};

const tokens: TokenMetadata[] = require('../resources/tokens.json');
const tokensProvider = {
    provide: 'tokens',
    useValue: tokens,
};

@Module({
    imports: [],
    controllers: [AppController],
    providers: [
        CompoundService,
        TokenService,
        walletProvider,
        tokensProvider,
        moneyMarketContractProvider,
    ],
})
export class AppModule { }
