import { Injectable, Inject } from '@nestjs/common';
import Axios from 'axios';
import { Agent } from 'https';
import { Wallet } from 'ethers';
import { CollateralizedSimpleInterestLoanAdapter } from './CollateralizedSimpleInterestLoanAdapter';
import { TokenSymbol } from '../tokens/TokenSymbol';
import { TokenMetadata } from '../tokens/TokenMetadata';
import { TokenAmount } from '../tokens/TokenAmount';
import { TransactionLog } from '../TransactionLog';
import { TokenService } from '../tokens/TokenService';
import { Logger } from 'winston';
import { RelayerDebtOrder, Status } from './models/RelayerDebtOrder';
import { DharmaOrdersFetcher } from './DharmaOrdersFetcher';
import { Price } from './models/Price';
import { Address } from 'src/types';
import { DebtOrderWrapper } from './wrappers/DebtOrderWrapper';
import { BigNumber } from 'ethers/utils';

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
        principalTokenSymbol?: TokenSymbol, collateralTokenSymbol?: TokenSymbol, minUsdAmount?: number, maxUsdAmount?: number,
    ): Promise<any[]> {
        const res = await this.ordersFetcher.fetchOrders(
            Status.SignedByCreditor,
            principalTokenSymbol,
            collateralTokenSymbol,
            minUsdAmount,
            maxUsdAmount,
        );

        const humanReadableResponse = await Promise.all(res.map(relayerOrder =>
            this.loanAdapter.fromRelayerDebtOrder(relayerOrder)
                .then(x => ({
                    id: relayerOrder.id,
                    principal: x.principal,
                    maxLtv: relayerOrder.maxLtv / 100,
                    interestRate: x.interestRate.toNumber() / 100,
                    termLength: x.termLength.toNumber(),
                    amortizationUnit: x.amortizationUnit,
                    collateralTokenSymbol: x.collateral.token.symbol,
                })),
        ));

        return humanReadableResponse;
    }

    async fillLendOffer(offerId: string, needAwaitMining: boolean): Promise<TransactionLog> {
        const transactions = new TransactionLog();
        const rawOffer = await this.ordersFetcher.fetchOrder(offerId);
        const offer = await this.convertLendOfferToProxyInstance(rawOffer);

        await this.tokenService.addUnlockTransactionIfNeeded(offer.collateralToken.symbol, this.tokenTransferProxyAddress, transactions);

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

        offer.setPrincipalPrice(principalPrice);
        offer.setCollateralPrice(collateralPrice);
        offer.setCollateralAmount(new BigNumber(collateralAmount.humanReadableAmount.toString()));

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

    async repayLendOffer(lendOfferId: string, rawAmount: BigNumber, needAwaitMining: boolean): Promise<TransactionLog> {
        const transactions = new TransactionLog();
        const rawOrder = await this.ordersFetcher.fetchOrder(lendOfferId);
        const order = await this.loanAdapter.fromRelayerDebtOrder(rawOrder);

        await this.tokenService.addUnlockTransactionIfNeeded(order.principal.token.symbol, this.tokenTransferProxyAddress, transactions);

        const tx = await this.debtOrderWrapperFactory.wrapDebtOrder(order).repay(
            rawAmount,
            { nonce: transactions.getNextNonce() },
        );

        this.logger.info(`Repaying loan with id ${lendOfferId}`);
        this.logger.info(`tx hash: ${tx.hash}`);

        transactions.add({
            name: 'repayLoan',
            transactionObject: tx,
        });

        if (needAwaitMining) {
            await transactions.wait();
        }

        return transactions;
    }

    async returnCollateral(orderId: string, needAwaitMining: boolean): Promise<TransactionLog> {
        const transactions = new TransactionLog();
        const rawOrder = await this.ordersFetcher.fetchOrder(orderId);
        const order = await this.loanAdapter.fromRelayerDebtOrder(rawOrder);

        return null;
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

    // TODO: TEST THIS THROUGHLY
    private async convertLendOfferToProxyInstance(relayerLendOffer: RelayerDebtOrder) {
        if (relayerLendOffer.maxLtv === undefined) {
            this.logger.error(`maxLtv is undefined in lend offer: ${JSON.stringify(relayerLendOffer)}`);
        }

        const parsedOffer = await this.loanAdapter.fromRelayerDebtOrder(relayerLendOffer);

        const result = this.debtOrderFactory.WrappedLendOffer(parsedOffer);

        return result;
    }
}