import { Module, Inject } from '@nestjs/common';
import { ethers } from 'ethers';
import winston = require('winston');
import { format } from 'winston';
import { WinstonModule } from 'nest-winston';
import * as ContractArtifacts from 'dharma-contract-artifacts';

import * as Compound from '../resources/money-market.json';
import * as Kyber from '../resources/kyber-network-proxy.json';
import * as Account from '../resources/account.json';
import * as Tokens from '../resources/tokens.json';
import * as LtvCreditorProxyAbi from '../resources/dharma/creditorProxyAbi.json';
import * as Addresses from '../resources/dharma/addresses.json';
import * as BloqboardAPI from '../resources/dharma/bloqboard-api.json';
import * as CurrencyRatesAPI from '../resources/dharma/currency-rates-api.json';

import { CompoundController } from './compound/compound.controller';
import { DharmaController } from './dharma/DharmaController';
import { CompoundService } from './compound/compound.service';
import { TokenService } from './tokens/TokenService';
import { KyberService } from './kyber/kyber.service';
import { KyberController } from './kyber/kyber.controller';
import { DharmaDebtRequestService } from './dharma/DharmaDebtRequestService';
import { CollateralizedSimpleInterestLoanAdapter } from './dharma/CollateralizedSimpleInterestLoanAdapter';
import { DharmaOrdersFetcher } from './dharma/DharmaOrdersFetcher';
import { DharmaLendOffersService } from './dharma/DharmaLendOffersService';
import { TokenMetadata } from './tokens/TokenMetadata';
import { DebtOrderWrapper } from './dharma/wrappers/DebtOrderWrapper';
import { MessageSigner } from './dharma/MessageSigner';
import { TokensController } from './tokens/TokensController';

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

@Module({
    imports: [
        WinstonModule.forRoot({
            transports: [
                new winston.transports.Console({
                    format: format.combine(
                        format.colorize(),
                        format.timestamp(),
                        format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`),
                    ),
                }),
            ],
        }),
    ],
    controllers: [CompoundController, KyberController, DharmaController, TokensController],
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
