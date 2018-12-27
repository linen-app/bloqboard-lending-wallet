import { Injectable, Inject } from '@nestjs/common';
import { Address, INTEREST_RATE_SCALING_FACTOR_MULTIPLIER } from '../../src/types';
import { Wallet } from 'ethers';
import { CollateralizedSimpleInterestLoanAdapter } from './CollateralizedSimpleInterestLoanAdapter';
import { TokenSymbol } from '../tokens/TokenSymbol';
import { TransactionLog } from '../common-models/TransactionLog';
import { TokenService } from '../tokens/TokenService';
import { Logger } from 'winston';
import { DharmaOrdersFetcher } from './DharmaOrdersFetcher';
import { Status } from './models/RelayerDebtOrder';
import { DebtOrderWrapper } from './wrappers/DebtOrderWrapper';
import { AmortizationUnit } from './models/UnpackedDebtOrderData';
import { HumanReadableDebtRequest } from './HumanReadableDebtRequest';
import { Pagination } from '../common-models/Pagination';

@Injectable()
export class DharmaDebtRequestService {

    constructor(
        @Inject('wallet') private readonly wallet: Wallet,
        @Inject('token-transfer-proxy-address') private readonly tokenTransferProxyAddress: Address,
        @Inject('winston') private readonly logger: Logger,
        private readonly ordersFetcher: DharmaOrdersFetcher,
        private readonly tokenService: TokenService,
        private readonly loanAdapter: CollateralizedSimpleInterestLoanAdapter,
        private readonly debtOrderWrapper: DebtOrderWrapper,
    ) { }

    async getDebtOrders(
        pagination: Pagination,
        principalTokenSymbol?: TokenSymbol,
        collateralTokenSymbol?: TokenSymbol,
        minUsdAmount?: number,
        maxUsdAmount?: number,
    ): Promise<HumanReadableDebtRequest[]> {
        const res = await this.ordersFetcher.fetchOrders(
            {
                status: Status.SignedByDebtor,
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
                    collateral: x.collateral.toString(),
                    interestRate: x.interestRate.toNumber() / INTEREST_RATE_SCALING_FACTOR_MULTIPLIER,
                    termLength: x.termLength.toNumber(),
                    amortizationUnit: AmortizationUnit[x.amortizationUnit],
                })),
        ));

        return humanReadableResponse;
    }

    async getMyLoanedOrders(pagination: Pagination): Promise<HumanReadableDebtRequest[]> {
        const res = await this.ordersFetcher.fetchOrders(
            {
                status: Status.Filled,
                kind: 'DebtRequest',
                creditor: this.wallet.address,
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

    async fillDebtRequest(requestId: string, needAwaitMining: boolean): Promise<TransactionLog> {
        const transactions = new TransactionLog();
        const rawOrder = await this.ordersFetcher.fetchOrder(requestId);
        const order = await this.loanAdapter.fromRelayerDebtOrder(rawOrder);

        await this.tokenService.addUnlockTransactionIfNeeded(order.principal.token.symbol, this.tokenTransferProxyAddress, transactions);

        order.creditor = this.wallet.address;
        const tx = await this.debtOrderWrapper.wrapDebtOrder(order).fill({ nonce: transactions.getNextNonce() });

        this.logger.info(`Filling debt request with id ${requestId}`);
        this.logger.info(`tx hash: ${tx.hash}`);

        transactions.add({
            name: 'fillDebtRequest',
            transactionObject: tx,
        });

        if (needAwaitMining) {
            await transactions.wait();
        }

        return transactions;
    }
}
