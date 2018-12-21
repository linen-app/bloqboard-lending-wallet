import { Injectable, Inject } from '@nestjs/common';
import { TokenSymbol, Address } from 'src/types';
import Axios from 'axios';
import { stringify } from 'qs';
import { Agent } from 'https';
import { Wallet } from 'ethers';
import { CollateralizedSimpleInterestLoanAdapter } from './collateralized-simple-interest-loan-adapter';
import { MaxLTVLoanOffer, MaxLTVData, CreditorValues, Price } from './ltv-creditor-proxy-wrapper.ts/max_ltv_loan_offer';
import { TimeInterval } from './ltv-creditor-proxy-wrapper.ts/time_interval';
import { TokenAmount } from './ltv-creditor-proxy-wrapper.ts/token_amount';
import { BigNumber } from 'bignumber.js';
import { InterestRate } from './ltv-creditor-proxy-wrapper.ts/interest_rate';
import { TransactionLog } from '../../src/TransactionLog';
import { TokenService } from '../../src/token.service';
import { Logger } from 'winston';

@Injectable()
export class DharmaService {

    constructor(
        @Inject('wallet') private readonly wallet: Wallet,
        @Inject('bloqboard-uri') private readonly bloqboardUri: string,
        @Inject('currency-rates-uri') private readonly currencyRatesUrl: string,
        @Inject('dharma-kernel-address') private readonly dharmaKernelAddress: Address,
        @Inject('creditor-proxy-address') private readonly creditorProxyAddress: Address,
        @Inject('token-transfer-proxy-address') private readonly tokenTransferProxyAddress: Address,
        @Inject('winston') private readonly logger: Logger,
        private readonly tokenService: TokenService,
        private readonly loadAdapter: CollateralizedSimpleInterestLoanAdapter,
    ) { }

    async getLendOffers(
        principalTokenSymbol?: TokenSymbol, collateralTokenSymbol?: TokenSymbol, minUsdAmount?: number, maxUsdAmount?: number,
    ): Promise<any[]> {
        const principalToken = principalTokenSymbol && this.tokenService.getTokenBySymbol(principalTokenSymbol);
        const collateralToken = collateralTokenSymbol && this.tokenService.getTokenBySymbol(collateralTokenSymbol);
        const res: any[] = await this.fetchLendOffers(
            principalToken && principalToken.address,
            collateralToken && collateralToken.address,
            minUsdAmount,
            maxUsdAmount,
        );

        const humanReadableResponse = res.map(x => {
            return {
                ...x,
            };
        });

        return humanReadableResponse;
    }

    async fillLendOffer(offerId: string, needAwaitMining: boolean): Promise<TransactionLog> {
        const transactions = new TransactionLog();
        const rawOffer = await this.fetchLendOffer(offerId);
        const { offer, principal, collateral } = await this.convertLendOfferToProxyInstance(rawOffer);

        const collateralSymbol = collateral.tokenSymbol as TokenSymbol;
        if (await this.tokenService.isTokenLockedForSpender(collateralSymbol, this.tokenTransferProxyAddress)) {
            const unlockTx = await this.tokenService.unlockToken(collateralSymbol, this.tokenTransferProxyAddress);
            transactions.add({
                name: 'unlock',
                transactionObject: unlockTx,
            });
        }

        const principalPrice = await this.getSignedRate(principal.tokenSymbol, 'USD');
        const collateralPrice = await this.getSignedRate(collateral.tokenSymbol, 'USD');

        const collateralAmount = this.calculateCollateral(
            principal.rawAmount,
            principalPrice.value,
            collateralPrice.value,
            collateral.tokenSymbol,
            rawOffer.maxLtv,
        );

        this.logger.info(`Collateral amount: ${collateralAmount}`);

        offer.setPrincipalPrice(principalPrice);
        offer.setCollateralPrice(collateralPrice);
        offer.setCollateralAmount(new BigNumber(collateralAmount.decimalAmount.toString()));

        const debtor = this.wallet.address.toLowerCase();
        await offer.signAsDebtor(debtor, false);
        const tx = await offer.acceptAsDebtor(debtor);

        this.logger.info(`Filling lend offer with id ${offerId}`);
        this.logger.info(`tx hash: ${tx.hash}`);

        transactions.add({
            name: 'fillLendOffer',
            transactionObject: tx,
        });

        if (needAwaitMining) {
            await transactions.wait();
        }

        return transactions;
    }

    private calculateCollateral(
        principalAmount: BigNumber,
        principalAmountUsdRate: number,
        collateralUsdRate: number,
        collateralTokenSymbol: string,
        ltv: number,
    ): TokenAmount {
        const usdAmount = principalAmount.mul(principalAmountUsdRate);
        const usdCollateral = usdAmount.div(new BigNumber(ltv).div(100));
        const collateral = usdCollateral.div(collateralUsdRate).mul(1.01);
        return TokenAmount.fromRaw(collateral, collateralTokenSymbol);
    }

    private async fetchLendOffer(offerId: string) {
        const debtsUrl = `${this.bloqboardUri}/Debts`;
        const response = await Axios.get(`${debtsUrl}/${offerId}`, {
            httpsAgent: new Agent({ rejectUnauthorized: false }),
        });

        return response.data;
    }

    private async fetchLendOffers(
        principalTokenAddress?: Address,
        collateralTokenAddress?: Address,
        minUsdAmount?: number,
        maxUsdAmount?: number,
    ) {
        const debtsUrl = `${this.bloqboardUri}/Debts`;
        const kernelAddress = this.dharmaKernelAddress;
        const pagination = {};
        const sorting = {};

        const filter = {
            // principalTokenAddresses: principalTokenAddress && [principalTokenAddress],
            // collateralTokenAddresses: collateralTokenAddress && [collateralTokenAddress],
            amountFrom: minUsdAmount,
            amountTo: maxUsdAmount,
        };

        const response = await Axios.get(debtsUrl, {
            params: {
                status: 'SignedByCreditor', ...pagination, kernelAddress, ...sorting, ...filter,
            },
            paramsSerializer: (params) => stringify(params, { allowDots: true, arrayFormat: 'repeat' }),
            httpsAgent: new Agent({ rejectUnauthorized: false }),
        });

        return response.data;
    }

    private async getSignedRate(source: string, target: string): Promise<Price> {
        const signedRatesApiUrl = this.currencyRatesUrl;
        const url = `${signedRatesApiUrl}/api/v0/rates/signed/${source}/${target}`;
        const result = await Axios.get(url, {
            httpsAgent: new Agent({ rejectUnauthorized: false }),
        });

        this.logger.info(`Rate recieved for pair ${source}/${target}: ${result.data.rate}`);

        return {
            value: result.data.rate,
            tokenAddress: result.data.targetCurrencyTokenAddress,
            timestamp: result.data.timeStamp,
            signature: {
                v: parseInt(result.data.signature.v, 16),
                r: `0x${result.data.signature.r}`,
                s: `0x${result.data.signature.s}`,
            },
        };
    }

    // TODO: TEST THIS THROUGHLY
    private async convertLendOfferToProxyInstance(relayerLendOffer: any) {
        if (relayerLendOffer.maxLtv === undefined) {
            this.logger.error(`maxLtv is undefined in lend offer: ${JSON.stringify(relayerLendOffer)}`);
        }

        const parsedOffer = await this.loadAdapter.fromDebtOrder({
            kernelVersion: relayerLendOffer.kernelAddress,
            issuanceVersion: relayerLendOffer.repaymentRouterAddress,
            principalAmount: new BigNumber(relayerLendOffer.principalAmount || 0),
            principalToken: relayerLendOffer.principalTokenAddress,
            debtor: relayerLendOffer.debtorAddress,
            debtorFee: new BigNumber(relayerLendOffer.debtorFee || 0),
            termsContract: relayerLendOffer.termsContractAddress,
            termsContractParameters: relayerLendOffer.termsContractParameters,
            expirationTimestampInSec: new BigNumber(new Date(relayerLendOffer.expirationTime).getTime() / 1000),
            salt: new BigNumber(relayerLendOffer.salt || 0),
            debtorSignature: relayerLendOffer.debtorSignature ? JSON.parse(relayerLendOffer.debtorSignature) : null,
            relayer: relayerLendOffer.relayerAddress,
            relayerFee: new BigNumber(relayerLendOffer.relayerFee || 0),
            underwriter: relayerLendOffer.underwriterAddress,
            underwriterRiskRating: new BigNumber(relayerLendOffer.underwriterRiskRating || 0),
            underwriterFee: new BigNumber(relayerLendOffer.underwriterFee || 0),
            underwriterSignature: relayerLendOffer.underwriterSignature ? JSON.parse(relayerLendOffer.underwriterSignature) : null,
            creditor: relayerLendOffer.creditorAddress,
            creditorSignature: relayerLendOffer.creditorSignature ? JSON.parse(relayerLendOffer.creditorSignature) : null,
            creditorFee: new BigNumber(relayerLendOffer.creditorFee || 0),
        });

        const principal = TokenAmount.fromRaw(parsedOffer.principalAmount, parsedOffer.principalTokenSymbol);
        const lendOfferParams: MaxLTVData = {
            collateralTokenAddress: parsedOffer.collateralTokenAddress,
            collateralTokenIndex: parsedOffer.collateralTokenIndex,
            collateralTokenSymbol: parsedOffer.collateralTokenSymbol,
            creditorFee: parsedOffer.creditorFee,
            debtorFee: parsedOffer.debtorFee,
            expiresIn: new TimeInterval(0, 'hours'), // not used, expirationTimestampInSec is set directly
            interestRate: InterestRate.fromRaw(parsedOffer.interestRate),
            issuanceVersion: parsedOffer.issuanceVersion,
            kernelVersion: parsedOffer.kernelVersion,
            maxLTV: new BigNumber(relayerLendOffer.maxLtv),
            priceProvider: relayerLendOffer.signerAddress,
            principal,
            principalTokenAddress: parsedOffer.principalTokenAddress,
            principalTokenIndex: parsedOffer.principalTokenIndex,
            relayer: parsedOffer.relayer,
            relayerFee: TokenAmount.fromRaw(parsedOffer.relayerFee, parsedOffer.principalTokenSymbol),
            salt: parsedOffer.salt,
            termLength: new TimeInterval(parsedOffer.termLength.toNumber(), parsedOffer.amortizationUnit),
            termsContract: parsedOffer.termsContract,
        };

        const creditorValued: CreditorValues = {
            creditor: parsedOffer.creditor,
            creditorSignature: parsedOffer.creditorSignature,
            expirationTimestampInSec: parsedOffer.expirationTimestampInSec,
        };

        const result = new MaxLTVLoanOffer(
            this.creditorProxyAddress,
            this.wallet,
            lendOfferParams,
            creditorValued,
        );

        return {
            offer: result,
            principal,
            collateral: TokenAmount.fromRaw(new BigNumber(0), parsedOffer.collateralTokenSymbol),
        };
    }
}
