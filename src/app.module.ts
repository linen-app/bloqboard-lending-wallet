import { Module, Inject } from '@nestjs/common';
import { ethers } from 'ethers';
import { format } from 'winston';
import { WinstonModule } from 'nest-winston';
import { CompoundController } from './compound/CompoundController';
import { DharmaController } from './dharma/DharmaController';
import { CompoundService } from './compound/CompoundService';
import { TokenService } from './tokens/TokenService';
import { KyberService } from './kyber/KyberService';
import { KyberController } from './kyber/KyberController';
import { DharmaDebtRequestService } from './dharma/DharmaDebtRequestService';
import { CollateralizedSimpleInterestLoanAdapter } from './dharma/CollateralizedSimpleInterestLoanAdapter';
import { DharmaOrdersFetcher } from './dharma/DharmaOrdersFetcher';
import { DharmaLendOffersService } from './dharma/DharmaLendOffersService';
import { TokenMetadata } from './tokens/TokenMetadata';
import { DebtOrderWrapper } from './dharma/wrappers/DebtOrderWrapper';
import { MessageSigner } from './dharma/MessageSigner';
import { TokensController } from './tokens/TokensController';
import { RootController } from './root/RootController';
import { BinanceService } from './binance/BinanceService';
import winston = require('winston');
import * as ContractArtifacts from 'dharma-contract-artifacts';
import BinanceClient from 'binance-api-node';

import * as Compound from '../resources/money-market.json';
import * as Kyber from '../resources/kyber-network-proxy.json';
import * as Account from '../resources/account.json';
import * as Tokens from '../resources/tokens.json';
import * as LtvCreditorProxyAbi from '../resources/dharma/creditorProxyAbi.json';
import * as Addresses from '../resources/dharma/addresses.json';
import * as BloqboardAPI from '../resources/dharma/bloqboard-api.json';
import * as CurrencyRatesAPI from '../resources/dharma/currency-rates-api.json';
import { WINSTON_MODULE } from './logger';

const NETWORK = process.env.NETWORK || 'kovan';
const provider = ethers.getDefaultProvider(NETWORK);
const privateKey = Account.privateKey;
const wallet = new ethers.Wallet(privateKey, provider);
const tokens: TokenMetadata[] = Tokens.networks[NETWORK];

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

const ltvCreditorProxyContract = new ethers.Contract(
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

const binanceClient = BinanceClient({
    apiKey: 'ZKEvT2o8ztWj50mkI1psIYZoV7uWc4TmQJzfrk8CNj1HTVQg2NpNpf6BY3NtSxf0',
    apiSecret: 'q2UEwz36yqYBLzeIsmj1lvtTKLheo7BqePa8KnVDqqE41hcEmjGnzo0hMVOcsNc2',
});

@Module({
    imports: [ WINSTON_MODULE ],
    controllers: [
        CompoundController,
        KyberController,
        DharmaController,
        TokensController,
        RootController,
    ],
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
        BinanceService,
        { provide: 'bloqboard-uri', useValue: BloqboardAPI.networks[NETWORK] },
        { provide: 'currency-rates-uri', useValue: CurrencyRatesAPI.networks[NETWORK] },
        { provide: 'wallet', useValue: wallet },
        { provide: 'tokens', useValue: tokens },
        { provide: 'signer', useValue: wallet },
        { provide: 'binance-client', useValue: binanceClient },

        { provide: 'dharma-kernel-address', useValue: debtKernelContract.address },
        { provide: 'creditor-proxy-address', useValue: ltvCreditorProxyContract.address },
        { provide: 'token-transfer-proxy-address', useValue: dharmaAddresses.TokenTransferProxy },

        { provide: 'dharma-kernel-contract', useValue: debtKernelContract },
        { provide: 'repayment-router-contract', useValue: repaymentRouterContract },
        { provide: 'collateralizer-contract', useValue: collateralizedContract },
        { provide: 'dharma-token-registry-contract', useValue: tokenRegistryContract },
        { provide: 'ltv-creditor-proxy-contract', useValue: ltvCreditorProxyContract },
        { provide: 'money-market-contract', useValue: moneyMarketContract },
        { provide: 'kyber-contract', useValue: kyberContract },
    ],
})
export class AppModule {
    constructor(
        @Inject('winston') logger: winston.Logger,
    ) {
        logger.info(`Application started with ${NETWORK} network`);
    }
}
