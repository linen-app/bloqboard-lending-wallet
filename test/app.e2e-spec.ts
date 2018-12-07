import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { ethers, Contract } from 'ethers';
import { TokenMetadata, TokenSymbol } from '../src/types';
import { CompoundService } from '../src/compound.service';
import { AppController } from '../src/app.controller';
import { TokenService } from '../src/token.service';
import * as Compound from '../resources/money-market.json';

describe('Compound API (e2e)', () => {
    let app: INestApplication;
    let moduleFixture: TestingModule;

    beforeAll(async () => {
        jest.setTimeout(120000);

        const provider = ethers.getDefaultProvider('rinkeby');
        const privateKey = require('../resources/account.json').privateKey;
        const wallet = new ethers.Wallet(privateKey, provider);
        const walletProvider = {
            provide: 'wallet',
            useValue: wallet,
        };

        const moneyMarketContract = new ethers.Contract(
            Compound.networks[4].address,
            Compound.abi,
            wallet,
        );
        const moneyMarketContractProvider = {
            provide: 'money-market-contract',
            useValue: moneyMarketContract,
        };

        const tokens: TokenMetadata[] = require('../resources/tokens.json');
        const tokensProvider = {
            provide: 'tokens',
            useValue: tokens,
        };

        moduleFixture = await Test.createTestingModule({
            controllers: [AppController],
            providers: [
                CompoundService,
                TokenService,
                walletProvider,
                tokensProvider,
                moneyMarketContractProvider,
            ],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });

    it('/token-balance (GET)', () => {
        return request(app.getHttpServer())
            .get('/token-balance?token=WETH')
            .expect(200)
            .expect(/[0-9]*\.?[0-9]+ WETH/);
    });

    it('/supply (POST)', async () => {
        const tokenService = moduleFixture.get<TokenService>(TokenService);
        const moneyMarketContract = moduleFixture.get<Contract>('money-market-contract');

        const lockTx = await tokenService.lockToken(TokenSymbol.WETH, moneyMarketContract.address);

        await lockTx.wait();

        return request(app.getHttpServer())
            .post('/supply?token=WETH&amount=0.0001&needAwaitMining=true')
            .expect(201);
    });

    it('/withdraw (POST)', async () => {
        return request(app.getHttpServer())
            .post('/withdraw?token=WETH&amount=0.0001&needAwaitMining=true')
            .expect(201);
    });
});
