import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { WinstonModule } from 'nest-winston';
import * as request from 'supertest';
import { ethers, Contract, utils } from 'ethers';
import winston = require('winston');
import { format } from 'winston';
import * as ContractArtifacts from 'dharma-contract-artifacts';

import { CompoundController } from '../src/compound/CompoundController';
import { CompoundService } from '../src/compound/CompoundService';
import { TokensController } from '../src/tokens/TokensController';
import { TokenService } from '../src/tokens/TokenService';
import { KyberService } from '../src/kyber/KyberService';
import { DharmaDebtRequestService } from '../src/dharma/DharmaDebtRequestService';
import { CollateralizedSimpleInterestLoanAdapter } from '../src/dharma/CollateralizedSimpleInterestLoanAdapter';
import { DharmaOrdersFetcher } from '../src/dharma/DharmaOrdersFetcher';
import { DharmaLendOffersService } from '../src/dharma/DharmaLendOffersService';
import { TokenMetadata } from '../src/tokens/TokenMetadata';
import { DebtOrderWrapper } from '../src/dharma/wrappers/DebtOrderWrapper';
import { MessageSigner } from '../src/dharma/MessageSigner';
import { TokenSymbol } from '../src/tokens/TokenSymbol';

import * as Compound from '../resources/money-market.json';
import * as Kyber from '../resources/kyber-network-proxy.json';
import * as Account from '../resources/account.json';
import * as Tokens from '../resources/tokens.json';
import * as LtvCreditorProxyAbi from '../resources/dharma/creditorProxyAbi.json';
import * as Addresses from '../resources/dharma/addresses.json';
import * as BloqboardAPI from '../resources/dharma/bloqboard-api.json';
import * as CurrencyRatesAPI from '../resources/dharma/currency-rates-api.json';
import { WINSTON_MODULE } from '../src/logger';

const parseBalance = (balance: number | string) => utils.parseEther(balance.toString());
const delta = '0.0001';

describe('Compound API (e2e)', () => {
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
        const NETWORK = 'kovan';
        const provider = ethers.getDefaultProvider(NETWORK);
        const privateKey = Account.privateKey;
        const wallet = new ethers.Wallet(privateKey, provider);
        const tokens: TokenMetadata[] = Tokens.networks[NETWORK].map(x => x as TokenMetadata);

        const moneyMarketContract = new ethers.Contract(
            Compound.networks[NETWORK].address,
            Compound.abi,
            wallet,
        );
        const kyberContract = new ethers.Contract(
            Kyber.networks[NETWORK].address,
            Kyber.abi,
            wallet,
        );

        const dharmaAddresses = Addresses[NETWORK];

        const ltvCreditorProcyContract = new ethers.Contract(
            dharmaAddresses.LtvCreditorProxy,
            LtvCreditorProxyAbi,
            wallet,
        );

        const tokenRegistryContract = new ethers.Contract(
            dharmaAddresses.TokenRegistry,
            ContractArtifacts.latest.TokenRegistry,
            wallet,
        );
        const debtKernelContract = new ethers.Contract(
            dharmaAddresses.DebtKernel,
            ContractArtifacts.latest.DebtKernel,
            wallet,
        );

        const repaymentRouterContract = new ethers.Contract(
            dharmaAddresses.RepaymentRouter,
            ContractArtifacts.latest.RepaymentRouter,
            wallet,
        );

        const collateralizedContract = new ethers.Contract(
            dharmaAddresses.Collateralizer,
            ContractArtifacts.latest.Collateralizer,
            wallet,
        );

        moduleFixture = await Test.createTestingModule({
            imports: [ WINSTON_MODULE ],
            controllers: [CompoundController, TokensController],
            providers: [
                CompoundService,
                KyberService,
                TokenService,
                DharmaDebtRequestService,
                DharmaLendOffersService,
                CollateralizedSimpleInterestLoanAdapter,
                DharmaOrdersFetcher,
                DebtOrderWrapper,
                MessageSigner,
                { provide: 'bloqboard-uri', useValue: BloqboardAPI.networks[NETWORK] },
                { provide: 'currency-rates-uri', useValue: CurrencyRatesAPI.networks[NETWORK] },
                { provide: 'wallet', useValue: wallet },
                { provide: 'tokens', useValue: tokens },
                { provide: 'signer', useValue: wallet },

                { provide: 'dharma-kernel-address', useValue: debtKernelContract.address },
                { provide: 'creditor-proxy-address', useValue: ltvCreditorProcyContract.address },
                { provide: 'token-transfer-proxy-address', useValue: dharmaAddresses.TokenTransferProxy },

                { provide: 'dharma-kernel-contract', useValue: debtKernelContract },
                { provide: 'repayment-router-contract', useValue: repaymentRouterContract },
                { provide: 'collateralizer-contract', useValue: collateralizedContract },
                { provide: 'dharma-token-registry-contract', useValue: tokenRegistryContract },
                { provide: 'ltv-creditor-proxy-contract', useValue: ltvCreditorProcyContract },
                { provide: 'money-market-contract', useValue: moneyMarketContract },
                { provide: 'kyber-contract', useValue: kyberContract },
            ],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });
});
