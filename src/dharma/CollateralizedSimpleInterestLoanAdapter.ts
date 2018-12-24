import { Inject, Injectable } from '@nestjs/common';
import { Contract } from 'ethers';
import { RelayerDebtOrder } from './models/RelayerDebtOrder';
import { ECDSASignature } from './models/ECDSASignature';
import { UnpackedDebtOrderData } from './models/UnpackedDebtOrderData';
import { unpackParameters } from './models/CollateralizedTermsContractParameters';
import { TokenAmount } from '../tokens/TokenAmount';
import { TokenService } from '../tokens/TokenService';
import { BigNumber } from 'ethers/utils';
import { Address } from 'src/types';

@Injectable()
export class CollateralizedSimpleInterestLoanAdapter {

    public constructor(
        private readonly tokenService: TokenService,
        @Inject('dharma-token-registry-contract') private readonly dharmaTokenRegistry: Contract,
    ) { }

    async fromRelayerDebtOrder(order: RelayerDebtOrder): Promise<UnpackedDebtOrderData> {
        const params = unpackParameters(order.termsContractParameters);

        const principalToken = this.tokenService.getTokenByAddress(order.principalTokenAddress);

        const collateralTokenAddress: Address = await this.dharmaTokenRegistry.getTokenAddressByIndex(
            params.collateralTokenIndex,
        );

        const collateralToken = await this.tokenService.getTokenByAddress(collateralTokenAddress);

        const debtOrderData: UnpackedDebtOrderData = {
            kernelVersion: order.kernelAddress,
            issuanceVersion: order.repaymentRouterAddress,
            principal: new TokenAmount(order.principalAmount, principalToken),
            debtor: order.debtorAddress,
            debtorFee: new TokenAmount(order.debtorFee, principalToken),
            termsContract: order.termsContractAddress,
            termsContractParameters: order.termsContractParameters,
            expirationTimestampInSec: new BigNumber(new Date(order.expirationTime).getTime() / 1000),
            salt: new BigNumber(order.salt),
            debtorSignature: this.parseSignature(order.debtorSignature),
            relayer: order.relayerAddress,
            relayerFee: new TokenAmount(order.relayerFee, principalToken),
            underwriter: order.underwriterAddress,
            underwriterRiskRating: new BigNumber(order.underwriterRiskRating), // TODO: convert to float
            underwriterFee: new TokenAmount(order.underwriterFee, principalToken),
            underwriterSignature: this.parseSignature(order.underwriterSignature),
            creditor: order.creditorAddress,
            creditorSignature: this.parseSignature(order.creditorSignature),
            creditorFee: new TokenAmount(order.creditorFee, principalToken),
            amortizationUnit: params.amortizationUnit,
            collateral: new TokenAmount(params.collateralAmount, collateralToken),
            gracePeriodInDays: params.gracePeriodInDays,
            interestRate: params.interestRate,
            termLength: params.termLength,
            principalTokenIndex: params.principalTokenIndex,
            collateralTokenIndex: params.collateralTokenIndex,

            maxLtv: order.maxLtv && new BigNumber(order.maxLtv),
            priceProvider: order.signerAddress,
        };

        return debtOrderData;
    }

    private parseSignature(serializedSignature: string) {
        const sign: ECDSASignature = serializedSignature && JSON.parse(serializedSignature);

        if (sign && sign.r) {
            return sign;
        }

        return ECDSASignature.NULL_SIGNATURE;
    }
}