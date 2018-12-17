import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { ethers, Contract, utils } from 'ethers';
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
            .expect(res => {
                if (!('WETH' in res.body)) throw new Error('missing token key');
                const isMatch = /[0-9]*\.?[0-9]+/.test(res.body.WETH);
                if (!isMatch) throw new Error(`Is not numeric value: ${res.body.amount}`);
            });
    });

    it('/supply (POST)', async () => {
        const tokenService = moduleFixture.get<TokenService>(TokenService);
        const moneyMarketContract = moduleFixture.get<Contract>('money-market-contract');
        const delta = '0.0001';
        const req = request(app.getHttpServer());

        const lockTx = await tokenService.lockToken(TokenSymbol.WETH, moneyMarketContract.address);
        await lockTx.wait();

        const rawTokenBalance = (await req.get('/token-balance?token=WETH')).body.WETH;
        const tokenBalance = utils.parseEther(rawTokenBalance);
        expect(tokenBalance.gte(utils.parseEther(delta))).toBeTruthy();

        const rawSupplyBalance = (await req.get('/supply-balance?token=WETH')).body.WETH;
        const supplyBalance = utils.parseEther(rawSupplyBalance);

        await req.post(`/supply?token=WETH&amount=${delta}&needAwaitMining=true`);

        const expectedTokenBalance = tokenBalance.sub(utils.parseEther(delta));
        await req.get('/token-balance?token=WETH').then(x => {
            expect(utils.parseEther(x.body.WETH).eq(expectedTokenBalance)).toBeTruthy();
        });

        const expectedSupplyBalance = supplyBalance.add(utils.parseEther(delta));
        await req.get('/supply-balance?token=WETH').then(x => {
            // gte, because between transaction and check some interest can be accumulated
            expect(utils.parseEther(x.body.WETH).gte(expectedSupplyBalance)).toBeTruthy();
        });
    });

    it('/withdraw (POST)', async () => {
        const delta = '0.0001';
        const req = request(app.getHttpServer());

        const rawTokenBalance = (await req.get('/token-balance?token=WETH')).body.WETH;
        const tokenBalance = utils.parseEther(rawTokenBalance);

        await req.post(`/withdraw?token=WETH&amount=${delta}&needAwaitMining=true`);

        const expectedTokenBalance = tokenBalance.add(utils.parseEther(delta));
        await req.get('/token-balance?token=WETH').then(x => {
            expect(utils.parseEther(x.body.WETH).eq(expectedTokenBalance)).toBeTruthy();
        });

    });
});
