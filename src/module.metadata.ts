import { ethers, Wallet } from 'ethers';
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
import winston = require('winston');
import * as ContractArtifacts from 'dharma-contract-artifacts';

import * as WrappedEther from '../resources/wrapped-ether.json';
import * as Compound from '../resources/money-market.json';
import * as Kyber from '../resources/kyber-network-proxy.json';
import * as Tokens from '../resources/tokens.json';
import * as LtvCreditorProxyAbi from '../resources/dharma/creditorProxyAbi.json';
import * as Addresses from '../resources/dharma/addresses.json';
import * as BloqboardAPI from '../resources/dharma/bloqboard-api.json';
import * as CurrencyRatesAPI from '../resources/dharma/currency-rates-api.json';
import { WrappedEtherService } from './tokens/WrappedEtherService';
import { ModuleMetadata } from '@nestjs/common/interfaces';

export function getModuleMetadata(wallet: Wallet, network: string): ModuleMetadata {
    const tokens: TokenMetadata[] = Tokens.networks[network];

    const wrappedEtherContract = new ethers.Contract(
        WrappedEther.networks[network].address,
        WrappedEther.abi,
        wallet,
    );

    const moneyMarketContract = new ethers.Contract(
        Compound.networks[network].address,
        Compound.abi,
        wallet,
    );

    const kyberContract = new ethers.Contract(
        Kyber.networks[network].address,
        Kyber.abi,
        wallet,
    );

    const dharmaAddresses = Addresses[network];

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

    return {
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
        controllers: [
            CompoundController,
            KyberController,
            DharmaController,
            TokensController,
            RootController,
        ],
        providers: [
            WrappedEtherService,
            CompoundService,
            KyberService,
            TokenService,
            DharmaDebtRequestService,
            DharmaLendOffersService,
            CollateralizedSimpleInterestLoanAdapter,
            DharmaOrdersFetcher,
            DebtOrderWrapper,
            MessageSigner,
            { provide: 'bloqboard-uri', useValue: BloqboardAPI.networks[network] },
            { provide: 'currency-rates-uri', useValue: CurrencyRatesAPI.networks[network] },
            { provide: 'wallet', useValue: wallet },
            { provide: 'tokens', useValue: tokens },
            { provide: 'signer', useValue: wallet },

            { provide: 'dharma-kernel-address', useValue: debtKernelContract.address },
            { provide: 'creditor-proxy-address', useValue: ltvCreditorProxyContract.address },
            { provide: 'token-transfer-proxy-address', useValue: dharmaAddresses.TokenTransferProxy },

            { provide: 'wrapped-ether-contract', useValue: wrappedEtherContract },
            { provide: 'dharma-kernel-contract', useValue: debtKernelContract },
            { provide: 'repayment-router-contract', useValue: repaymentRouterContract },
            { provide: 'collateralizer-contract', useValue: collateralizedContract },
            { provide: 'dharma-token-registry-contract', useValue: tokenRegistryContract },
            { provide: 'ltv-creditor-proxy-contract', useValue: ltvCreditorProxyContract },
            { provide: 'money-market-contract', useValue: moneyMarketContract },
            { provide: 'kyber-contract', useValue: kyberContract },
        ],
    };
}