import { Injectable, Inject } from '@nestjs/common';
import { TokenSymbol, Address } from 'src/types';
import Axios from 'axios';
import { stringify } from 'qs';
import { Agent } from 'https';
import { Wallet, Contract } from 'ethers';
import { CollateralizedSimpleInterestLoanAdapter } from './collateralized-simple-interest-loan-adapter';
import { MaxLTVLoanOffer, MaxLTVData, CreditorValues, Price } from './ltv-creditor-proxy-wrapper/max_ltv_loan_offer';
import { TimeInterval } from './models/time_interval';
import { TokenAmount } from './models/token_amount';
import { BigNumber } from 'bignumber.js';
import { InterestRate } from './models/interest_rate';
import { TransactionLog } from '../../src/TransactionLog';
import { TokenService } from '../../src/token.service';
import { Logger } from 'winston';
import { RelayerDebtOrder, Status } from './models/relayer-debt-order';
import { DebtOrderWrapper } from './dharma.debtOrder.wrapper';

@Injectable()
export class DharmaService {

    constructor(
        @Inject('wallet') private readonly wallet: Wallet,
        @Inject('bloqboard-uri') private readonly bloqboardUri: string,
        @Inject('currency-rates-uri') private readonly currencyRatesUrl: string,
        @Inject('dharma-kernel-contract') private readonly dharmaKernel: Contract,
        @Inject('repayment-router-contract') private readonly repaymentRouter: Contract,
        @Inject('collateralizer-contract') private readonly collateralizer: Contract,
        @Inject('creditor-proxy-address') private readonly creditorProxyAddress: Address,
        @Inject('token-transfer-proxy-address') private readonly tokenTransferProxyAddress: Address,
        @Inject('winston') private readonly logger: Logger,
        private readonly tokenService: TokenService,
        private readonly loanAdapter: CollateralizedSimpleInterestLoanAdapter,
    ) { }

    async getDebtOrders(
        principalTokenSymbol?: TokenSymbol, collateralTokenSymbol?: TokenSymbol, minUsdAmount?: number, maxUsdAmount?: number,
    ): Promise<any[]> {
        const res = await this.fetchOrders(Status.SignedByDebtor, principalTokenSymbol, collateralTokenSymbol, minUsdAmount, maxUsdAmount);

        const humanReadableResponse = await Promise.all(res.map(relayerOrder =>
            this.loanAdapter.fromRelayerDebtOrder(relayerOrder)
                .then(x => ({
                    id: relayerOrder.id,
                    principal: TokenAmount.fromRaw(x.principalAmount, x.principalTokenSymbol).toString(),
                    collateral: TokenAmount.fromRaw(x.collateralAmount, x.collateralTokenSymbol).toString(),
                    interestRate: x.interestRate.toNumber() / 100,
                    termLength: x.termLength.toNumber(),
                    amortizationUnit: x.amortizationUnit,
                })),
        ));

        return humanReadableResponse;
    }

    async getLendOffers(
        principalTokenSymbol?: TokenSymbol, collateralTokenSymbol?: TokenSymbol, minUsdAmount?: number, maxUsdAmount?: number,
    ): Promise<any[]> {
        const res = await this.fetchOrders(Status.SignedByCreditor, principalTokenSymbol, collateralTokenSymbol, minUsdAmount, maxUsdAmount);

        const humanReadableResponse = await Promise.all(res.map(relayerOrder =>
            this.loanAdapter.fromRelayerDebtOrder(relayerOrder)
                .then(x => ({
                    id: relayerOrder.id,
                    principal: TokenAmount.fromRaw(x.principalAmount, x.principalTokenSymbol).toString(),
                    maxLtv: relayerOrder.maxLtv / 100,
                    interestRate: x.interestRate.toNumber() / 100,
                    termLength: x.termLength.toNumber(),
                    amortizationUnit: x.amortizationUnit,
                    collateralTokenSymbol: x.collateralTokenSymbol,
                })),
        ));

        return humanReadableResponse;
    }

    async fillLendOffer(offerId: string, needAwaitMining: boolean): Promise<TransactionLog> {
        const transactions = new TransactionLog();
        const rawOffer = await this.fetchOrder(offerId);
        const { offer, principal, collateral } = await this.convertLendOfferToProxyInstance(rawOffer);

        await this.tokenService.addUnlockTransactionIfNeeded(collateral.tokenSymbol as TokenSymbol, this.tokenTransferProxyAddress, transactions);

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
        const tx = await offer.acceptAsDebtor(debtor, { nonce: transactions.getNextNonce() });

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

    async fillDebtRequest(requestId: string, needAwaitMining: boolean): Promise<TransactionLog> {
        const transactions = new TransactionLog();
        const rawOrder = await this.fetchOrder(requestId);
        const order = await this.loanAdapter.fromRelayerDebtOrder(rawOrder);

        await this.tokenService.addUnlockTransactionIfNeeded(order.principalTokenSymbol as TokenSymbol, this.tokenTransferProxyAddress, transactions);

        order.creditor = this.wallet.address;
        const wrapper = new DebtOrderWrapper(order, this.dharmaKernel);

        const tx = await wrapper.fillDebtOrder({ nonce: transactions.getNextNonce() });

        this.logger.info(`Filling debt request with id ${requestId}`);
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

    private async fetchOrder(offerId: string): Promise<RelayerDebtOrder> {
        const debtsUrl = `${this.bloqboardUri}/Debts`;
        const response = await Axios.get(`${debtsUrl}/${offerId}`, {
            httpsAgent: new Agent({ rejectUnauthorized: false }),
        });

        return response.data;
    }

    private async fetchOrders(
        status: Status,
        principalTokenSymbol?: TokenSymbol,
        collateralTokenSymbol?: TokenSymbol,
        minUsdAmount?: number,
        maxUsdAmount?: number,
    ): Promise<RelayerDebtOrder[]> {
        const debtsUrl = `${this.bloqboardUri}/Debts`;
        const kernelAddress = this.dharmaKernel.address;
        const pagination = {};
        const sorting = {};

        const principalToken = principalTokenSymbol && this.tokenService.getTokenBySymbol(principalTokenSymbol);
        const collateralToken = collateralTokenSymbol && this.tokenService.getTokenBySymbol(collateralTokenSymbol);

        const filter = {
            // principalTokenAddresses: principalTokenAddress && [principalTokenAddress],
            // collateralTokenAddresses: collateralTokenAddress && [collateralTokenAddress],
            amountFrom: minUsdAmount,
            amountTo: maxUsdAmount,
        };

        const response = await Axios.get(debtsUrl, {
            params: {
                status, ...pagination, kernelAddress, ...sorting, ...filter,
            },
            paramsSerializer: (params) => stringify(params, { allowDots: true, arrayFormat: 'repeat' }),
            httpsAgent: new Agent({ rejectUnauthorized: false }),
        });

        this.logger.info(`Recieved ${response.data.length} debt orders from ${response.config.url}${response.request.path}`);

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
    private async convertLendOfferToProxyInstance(relayerLendOffer: RelayerDebtOrder) {
        if (relayerLendOffer.maxLtv === undefined) {
            this.logger.error(`maxLtv is undefined in lend offer: ${JSON.stringify(relayerLendOffer)}`);
        }

        const parsedOffer = await this.loanAdapter.fromRelayerDebtOrder(relayerLendOffer);

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
