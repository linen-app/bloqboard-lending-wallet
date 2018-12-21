import { Module, Inject } from '@nestjs/common';
import { ethers } from 'ethers';
import winston = require('winston');
import { format } from 'winston';
import { WinstonModule } from 'nest-winston';
import * as DharmaAddressBook from 'dharma-address-book';
import * as ContractArtifacts from 'dharma-contract-artifacts';
import { CompoundController } from './compound/compound.controller';
import { CompoundService } from './compound/compound.service';
import { TokenService } from './token.service';
import { TokenMetadata } from './types';
import { KyberService } from './kyber/kyber.service';
import { KyberController } from './kyber/kyber.controller';
import { DharmaService } from './dharma/dharma.service';
import { DharmaController } from './dharma/dharma.controller';
import * as Compound from '../resources/money-market.json';
import * as Kyber from '../resources/kyber-network-proxy.json';
import * as Account from '../resources/account.json';
import * as Tokens from '../resources/tokens.json';
import * as CreditorProxy from '../resources/dharma/creditor-proxy.json';
import * as BloqboardAPI from '../resources/dharma/bloqboard-api.json';
import * as CurrencyRatesAPI from '../resources/dharma/currency-rates-api.json';

import { CollateralizedSimpleInterestLoanAdapter } from './dharma/collateralized-simple-interest-loan-adapter';

const NETWORK = process.env.NETWORK || 'rinkeby';
const provider = ethers.getDefaultProvider(NETWORK);
const privateKey = Account.privateKey;
const wallet = new ethers.Wallet(privateKey, provider);

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

const dharmaAddresses = DharmaAddressBook.latest[NETWORK === 'mainnet' ? 'live' : NETWORK];

const tokenRegistryContract = new ethers.Contract(
    dharmaAddresses.TokenRegistry,
    ContractArtifacts.latest.TokenRegistry,
    wallet,
);

const tokens: TokenMetadata[] = Tokens.networks[NETWORK];

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
    controllers: [CompoundController, KyberController, DharmaController],
    providers: [
        CompoundService,
        KyberService,
        TokenService,
        DharmaService,
        CollateralizedSimpleInterestLoanAdapter,
        { provide: 'bloqboard-uri', useValue: BloqboardAPI.networks[NETWORK] },
        { provide: 'currency-rates-uri', useValue: CurrencyRatesAPI.networks[NETWORK] },
        { provide: 'dharma-kernel-address', useValue: dharmaAddresses.DebtKernel },
        { provide: 'token-transfer-proxy-address', useValue: dharmaAddresses.TokenTransferProxy },
        { provide: 'creditor-proxy-address', useValue: CreditorProxy.networks[NETWORK].address },
        { provide: 'dharma-token-registry-contract', useValue: tokenRegistryContract },
        { provide: 'wallet', useValue: wallet },
        { provide: 'tokens', useValue: tokens },
        { provide: 'money-market-contract', useValue: moneyMarketContract },
        { provide: 'kyber-contract', useValue: kyberContract },
    ],
})
export class AppModule {
    constructor(
        @Inject('winston') private readonly logger: winston.Logger,
    ) {
        logger.info(`Application started with ${NETWORK} network`);
    }
}
