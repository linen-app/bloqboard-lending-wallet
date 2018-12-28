import { Test, TestingModule } from '@nestjs/testing';
import { ethers } from 'ethers';
import { BinanceService } from './BinanceService';
import BinanceClient from 'binance-api-node';
import { TokenSymbol } from '../tokens/TokenSymbol';
import { WINSTON_MODULE } from '../logger';
import { TokenService } from '../tokens/TokenService';
import { TokenMetadata } from '../tokens/TokenMetadata';
import * as Account from '../../resources/account.json';
import * as Tokens from '../../resources/tokens.json';

describe('BinanceService', () => {
    let service: BinanceService;

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should return account info', async () => {
        const accountInfo = await service.getAccountInfo();
        expect(accountInfo.canTrade).toBeTruthy();
    });

    xit('should be able to deposit ZRX', async () => {
        const log = await service.deposit(5, TokenSymbol.ZRX, false);
        expect(log.transactions.pop().transactionObject.hash).toBeTruthy();
    });

    it('should be able to sell ZRX', async () => {
        await service.sell(5, TokenSymbol.ZRX, TokenSymbol.WETH);
    });

    xit('should be able to withdraw ZRX', async () => {
        await service.withdraw(5, TokenSymbol.ZRX);
    });

    beforeAll(async () => {
        jest.setTimeout(120000);
        const NETWORK = 'mainnet';
        const provider = ethers.getDefaultProvider(NETWORK);
        const privateKey = Account.privateKey;
        const wallet = new ethers.Wallet(privateKey, provider);

        const tokens: TokenMetadata[] = Tokens.networks[NETWORK].map(x => x as TokenMetadata);

        const binanceClient = BinanceClient({
            apiKey: Account.binance.apiKey,
            apiSecret: Account.binance.secretKey,
        });

        const module: TestingModule = await Test.createTestingModule({
            imports: [WINSTON_MODULE],
            providers: [
                TokenService,
                BinanceService,
                { provide: 'binance-client', useValue: binanceClient },
                { provide: 'tokens', useValue: tokens },
                { provide: 'wallet', useValue: wallet },
                { provide: 'address', useValue: wallet.address },
            ],
        }).compile();
        service = module.get<BinanceService>(BinanceService);
    });
});
