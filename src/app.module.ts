import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TokenService } from './token.service';

class TokenMetadata {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
}

const privateKeyProvider = {
    provide: 'private-key',
    useValue: require('../resources/account.json').privateKey,
};

const tokens: TokenMetadata[] = require('../resources/tonens.json');
const tolensProvider = {
    provide: 'tokens',
    useValue: tokens,
};

@Module({
    imports: [],
    controllers: [AppController],
    providers: [AppService, TokenService, privateKeyProvider, tolensProvider],
})
export class AppModule { }
