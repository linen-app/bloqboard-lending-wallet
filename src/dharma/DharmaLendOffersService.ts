import { Injectable, Inject } from '@nestjs/common';
import Axios from 'axios';
import { Agent } from 'https';
import { Wallet, constants } from 'ethers';
import { CollateralizedSimpleInterestLoanAdapter } from './CollateralizedSimpleInterestLoanAdapter';
import { TokenSymbol } from '../tokens/TokenSymbol';
import { TokenMetadata } from '../tokens/TokenMetadata';
import { TokenAmount } from '../tokens/TokenAmount';
import { TransactionLog } from '../common-models/TransactionLog';
import { TokenService } from '../tokens/TokenService';
import { Logger } from 'winston';
import { RelayerDebtOrder, Status } from './models/RelayerDebtOrder';
import { DharmaOrdersFetcher } from './DharmaOrdersFetcher';
import { Price } from './models/Price';
import { Address, INTEREST_RATE_SCALING_FACTOR_MULTIPLIER } from '../../src/types';
import { DebtOrderWrapper } from './wrappers/DebtOrderWrapper';
import { AmortizationUnit } from './models/UnpackedDebtOrderData';
import { HumanReadableLendOffer } from './HumanReadableLendOffer';
import { HumanReadableDebtRequest } from './HumanReadableDebtRequest';
import { Pagination } from '../common-models/Pagination';

@Injectable()
export class DharmaLendOffersService {
    constructor(
        @Inject('wallet') private readonly wallet: Wallet,
        @Inject('currency-rates-uri') private readonly currencyRatesUrl: string,
        @Inject('token-transfer-proxy-address') private readonly tokenTransferProxyAddress: Address,
        @Inject('winston') private readonly logger: Logger,
        private readonly debtOrderFactory: DebtOrderWrapper,
        private readonly ordersFetcher: DharmaOrdersFetcher,
        private readonly tokenService: TokenService,
        private readonly loanAdapter: CollateralizedSimpleInterestLoanAdapter,
        private readonly debtOrderWrapperFactory: DebtOrderWrapper,
    ) { }

    async getLendOffers(
        pagination: Pagination,
        principalTokenSymbol?: TokenSymbol,
        collateralTokenSymbol?: TokenSymbol,
        minUsdAmount?: number,
        maxUsdAmount?: number,
    ): Promise<HumanReadableLendOffer[]> {
        const res = await this.ordersFetcher.fetchOrders(
            {
                status: Status.SignedByCreditor,
                principalTokenSymbol,
                collateralTokenSymbol,
                minUsdAmount,
                maxUsdAmount,
            },
            pagination,
        );

        const humanReadableResponse = await Promise.all(res.map(relayerOrder =>
            this.loanAdapter.fromRelayerDebtOrder(relayerOrder)
                .then(x => ({
                    id: relayerOrder.id,
                    principal: x.principal.toString(),
                    maxLtv: relayerOrder.maxLtv / 100,
                    interestRate: x.interestRate.toNumber() / INTEREST_RATE_SCALING_FACTOR_MULTIPLIER,
                    termLength: x.termLength.toNumber(),
                    amortizationUnit: AmortizationUnit[x.amortizationUnit],
                    collateralTokenSymbol: x.collateral.token.symbol,
                })),
        ));

        return humanReadableResponse;
    }

    async getMyBorrowedOrders(pagination: Pagination): Promise<HumanReadableDebtRequest[]> {
        const res = await this.ordersFetcher.fetchOrders(
            {
                status: Status.Filled,
                kind: 'LendOffer',
                debtor: this.wallet.address,
            },
            pagination,
        );

        const humanReadableResponse = await Promise.all(res.map(relayerOrder =>
            this.loanAdapter.fromRelayerDebtOrder(relayerOrder)
                .then(x => ({
                    id: relayerOrder.id,
                    principal: x.principal.toString(),
                    collateral: x.collateral.toString(),
                    interestRate: x.interestRate.toNumber() / INTEREST_RATE_SCALING_FACTOR_MULTIPLIER,
                    termLength: x.termLength.toNumber(),
                    amortizationUnit: AmortizationUnit[x.amortizationUnit],
                })),
        ));

        return humanReadableResponse;
    }

    async fillLendOffer(offerId: string, needAwaitMining: boolean): Promise<TransactionLog> {
        const transactions = new TransactionLog();
        const rawOffer = await this.ordersFetcher.fetchOrder(offerId);
        const offer = await this.convertLendOfferToProxyInstance(rawOffer);

        const principalPrice = await this.getSignedRate(offer.principal.token.symbol, 'USD');
        const collateralPrice = await this.getSignedRate(offer.collateralToken.symbol, 'USD');

        const collateralAmount = this.calculateCollateral(
            offer.principal,
            principalPrice.value,
            collateralPrice.value,
            offer.collateralToken,
            rawOffer.maxLtv,
        );

        this.logger.info(`Collateral amount: ${collateralAmount}`);

        await this.tokenService.assertTokenBalance(collateralAmount);
        await this.tokenService.addUnlockTransactionIfNeeded(offer.collateralToken.symbol, this.tokenTransferProxyAddress, transactions);

        offer.setPrincipalPrice(principalPrice);
        offer.setCollateralPrice(collateralPrice);
        offer.setCollateralAmount(collateralAmount.rawAmount);

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

    async repayLendOffer(lendOfferId: string, humanReadableAmount: number, needAwaitMining: boolean): Promise<TransactionLog> {
        const transactions = new TransactionLog();
        const rawOrder = await this.ordersFetcher.fetchOrder(lendOfferId);
        const order = await this.loanAdapter.fromRelayerDebtOrder(rawOrder);
        const amount = TokenAmount.fromHumanReadable(humanReadableAmount, order.principal.token);
        const wrappedOffer = this.debtOrderWrapperFactory.wrapLendOffer(order);

        const actualAmount = amount.rawAmount.eq(constants.MaxUint256) ?
            new TokenAmount(await wrappedOffer.getOutstandingRepaymentAmount(), amount.token) :
            amount;

        await this.tokenService.assertTokenBalance(actualAmount);
        await this.tokenService.addUnlockTransactionIfNeeded(actualAmount.token.symbol, this.tokenTransferProxyAddress, transactions);

        const repayTx = await wrappedOffer.repay(
            actualAmount.rawAmount,
            { nonce: transactions.getNextNonce() },
        );

        this.logger.info(`Repaying loan with id ${lendOfferId}`);
        this.logger.info(`tx hash: ${repayTx.hash}`);

        transactions.add({
            name: 'repayLoan',
            transactionObject: repayTx,
        });

        if (amount.rawAmount.eq(constants.MaxUint256)) {
            const returnTx = await wrappedOffer.returnCollateral({
                nonce: transactions.getNextNonce(),
            });

            this.logger.info(`Returning collateral for loan with id ${lendOfferId}`);
            this.logger.info(`tx hash: ${returnTx.hash}`);

            transactions.add({
                name: 'returnCollateral',
                transactionObject: returnTx,
            });
        }

        if (needAwaitMining) {
            await transactions.wait();
        }

        return transactions;
    }

    async returnCollateral(lendOfferId: string, needAwaitMining: boolean): Promise<TransactionLog> {
        const transactions = new TransactionLog();
        const rawOrder = await this.ordersFetcher.fetchOrder(lendOfferId);
        const order = await this.loanAdapter.fromRelayerDebtOrder(rawOrder);

        const tx = await this.debtOrderWrapperFactory.wrapLendOffer(order).returnCollateral(
            { nonce: transactions.getNextNonce() },
        );

        this.logger.info(`Returning collateral for loan with id ${lendOfferId}`);
        this.logger.info(`tx hash: ${tx.hash}`);

        transactions.add({
            name: 'returnCollateral',
            transactionObject: tx,
        });

        if (needAwaitMining) {
            await transactions.wait();
        }

        return transactions;
    }

    private calculateCollateral(
        principal: TokenAmount,
        principalAmountUsdRate: number,
        collateralUsdRate: number,
        collateralToken: TokenMetadata,
        ltv: number,
    ): TokenAmount {
        const usdAmount = principal.humanReadableAmount * principalAmountUsdRate;
        const usdCollateral = usdAmount / (ltv / 100);
        const collateral = (usdCollateral / collateralUsdRate) * 1.01;

        return TokenAmount.fromHumanReadable(collateral, collateralToken);
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

    private async convertLendOfferToProxyInstance(relayerLendOffer: RelayerDebtOrder) {
        if (relayerLendOffer.maxLtv === undefined) {
            this.logger.error(`maxLtv is undefined in lend offer: ${JSON.stringify(relayerLendOffer)}`);
        }

        const parsedOffer = await this.loanAdapter.fromRelayerDebtOrder(relayerLendOffer);

        const result = this.debtOrderFactory.wrapLendOffer(parsedOffer);

        return result;
    }
}