import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { ethers, Contract, utils } from 'ethers';

import { TokenService } from '../src/tokens/TokenService';
import { TokenSymbol } from '../src/tokens/TokenSymbol';

import { getModuleMetadata } from '../src/module.metadata';

import * as Account from '../resources/account.json';
import { WrappedEtherService } from '../src/tokens/WrappedEtherService';

const parseBalance = (balance: number | string) => utils.parseEther(balance.toString());
const delta = '0.0001';

describe('API (e2e)', () => {
    let app: INestApplication;
    let moduleFixture: TestingModule;

    it('/tokens/balance (GET)', () => {
        return request(app.getHttpServer())
            .get('/tokens/balance?token=WETH')
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
        const req = request(app.getHttpServer());

        const lockTx = await tokenService.lockToken(TokenSymbol.WETH, moneyMarketContract.address);
        await lockTx.wait();

        const rawTokenBalance = (await req.get('/tokens/balance?token=WETH')).body.WETH;
        const tokenBalance = parseBalance(rawTokenBalance);
        expect(tokenBalance.gte(parseBalance(delta))).toBeTruthy();

        const rawSupplyBalance = (await req.get('/compound/supply-balance?token=WETH')).body.WETH;
        const supplyBalance = parseBalance(rawSupplyBalance);

        await req.post(`/compound/supply?token=WETH&amount=${delta}&needAwaitMining=true`);

        const expectedTokenBalance = tokenBalance.sub(parseBalance(delta));
        await req.get('/tokens/balance?token=WETH').then(x => {
            expect(parseBalance(x.body.WETH).eq(expectedTokenBalance)).toBeTruthy();
        });

        const expectedSupplyBalance = supplyBalance.add(parseBalance(delta));
        await req.get('/compound/supply-balance?token=WETH').then(x => {
            // gte, because between transaction and check some interest can be accumulated
            expect(parseBalance(x.body.WETH).gte(expectedSupplyBalance)).toBeTruthy();
        });
    });

    it('/withdraw (POST)', async () => {
        const req = request(app.getHttpServer());

        const rawTokenBalance = (await req.get('/tokens/balance?token=WETH')).body.WETH;
        const tokenBalance = parseBalance(rawTokenBalance);

        await req.post(`/compound/withdraw?token=WETH&amount=${delta}&needAwaitMining=true`);

        const expectedTokenBalance = tokenBalance.add(parseBalance(delta));
        await req.get('/tokens/balance?token=WETH').then(x => {
            expect(parseBalance(x.body.WETH).eq(expectedTokenBalance)).toBeTruthy();
        });

    });

    beforeAll(async () => {
        jest.setTimeout(120000);
        const network = 'kovan';
        const provider = ethers.getDefaultProvider(network);
        const privateKey = Account.privateKey;
        const wallet = new ethers.Wallet(privateKey, provider);

        moduleFixture = await Test.createTestingModule(getModuleMetadata(wallet, network)).compile();

        app = moduleFixture.createNestApplication();
        await app.init();

        const wethService = moduleFixture.get<WrappedEtherService>(WrappedEtherService);
        await wethService.wrapEth(+delta, true);
    });
});
