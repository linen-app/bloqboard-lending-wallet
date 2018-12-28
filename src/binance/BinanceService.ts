import { Injectable, Inject } from '@nestjs/common';
import { Binance, Account, OrderSide } from 'binance-api-node';
import { Logger } from 'winston';
import { TokenSymbol } from '../tokens/TokenSymbol';
import { TokenAmount } from '../tokens/TokenAmount';
import { TokenService } from '../tokens/TokenService';
import { InvariantViolationError } from '../errors/SmartContractInvariantViolationError';
import { TransactionLog } from '../common-models/TransactionLog';

const supportedTokens = [TokenSymbol.WETH, TokenSymbol.BAT, TokenSymbol.REP, TokenSymbol.ZRX];
const availableMarkets = supportedTokens.filter(x => x !== TokenSymbol.WETH).map(x => x + 'ETH');

@Injectable()
export class BinanceService {
    constructor(
        @Inject('binance-client') private readonly binanceClient: Binance,
        @Inject('address') private readonly address: string,
        @Inject('winston') private readonly logger: Logger,
        private readonly tokenService: TokenService,
    ) { }

    async getAccountInfo(): Promise<Account> {
        const info = await this.binanceClient.accountInfo();
        return info;
    }

    async deposit(humanReadableAmount: number, tokenSymbol: TokenSymbol, needAwaitMining: boolean): Promise<TransactionLog> {
        const token = this.tokenService.getTokenBySymbol(tokenSymbol);
        const amount = TokenAmount.fromHumanReadable(humanReadableAmount, token);
        await this.tokenService.assertTokenBalance(amount);

        if (!supportedTokens.includes(tokenSymbol)) {
            throw new InvariantViolationError(`Token is not supported on Binance: ${tokenSymbol}`);
        }

        const response = await this.binanceClient.depositAddress({ asset: token.symbol });

        if (!response.success || response.asset !== tokenSymbol) {
            throw new InvariantViolationError('Error occured getting Binance deposit address');
        }

        this.logger.info(`Depositing ${amount} to binance address ${response.address}`);

        const transactons = new TransactionLog();
        const tx = await this.tokenService.sendToken(amount, response.address);

        transactons.add({
            name: 'deposit',
            transactionObject: tx,
        });

        if (needAwaitMining) {
            await transactons.wait();
        }

        return transactons;
    }

    async getDepositHistory(tokenSymbol: TokenSymbol) {
        const parsedSymbol = this.parseSymbol(tokenSymbol);
        const response = await this.binanceClient.depositHistory({ asset: parsedSymbol });

        return response.depositList;
    }

    async withdraw(humanReadableAmount: number, tokenSymbol: TokenSymbol) {
        const token = this.tokenService.getTokenBySymbol(tokenSymbol);
        const amount = TokenAmount.fromHumanReadable(humanReadableAmount, token);

        if (!supportedTokens.includes(tokenSymbol)) {
            throw new InvariantViolationError(`Token is not supported on Binance: ${tokenSymbol}`);
        }

        const assetsDetail = await this.binanceClient.assetDetail();
        const assetDetail = assetsDetail.assetDetail[amount.token.symbol];

        if (!(
            assetDetail &&
            assetDetail.withdrawStatus &&
            Number.parseFloat(assetDetail.minWithdrawAmount) <= amount.humanReadableAmount
        )) {
            throw new InvariantViolationError(`Cant withdraw ${amount} from Binance: ${JSON.stringify(assetDetail)}`);
        }

        const response = await this.binanceClient.withdraw({
            asset: amount.token.symbol,
            amount: amount.humanReadableAmount,
            address: this.address,
            name: 'Bloqboard wallet',
        });

        if (!response.success) {
            throw new InvariantViolationError(`Error occured withdrawing ${amount} from Binance: ${response.msg}`);
        }

        this.logger.info(
            `Withdrawing ${amount} from Binance address: ${response.msg}. id: ${response.id}. ` +
            `Binance withdrawal fee: ${assetDetail.withdrawFee}`,
        );
    }

    async getWithdrawHistory(tokenSymbol: TokenSymbol) {
        const parsedSymbol = this.parseSymbol(tokenSymbol);
        const response = await this.binanceClient.withdrawHistory({ asset: parsedSymbol });

        return response.withdrawList;
    }

    async sell(humanReadableAmountToSell: number, symbolToSell: TokenSymbol, symbolToBuy: TokenSymbol) {
        const tokenToSell = this.tokenService.getTokenBySymbol(symbolToSell);
        const amountToSell = TokenAmount.fromHumanReadable(humanReadableAmountToSell, tokenToSell);

        const { symbol, side } = this.getBinanceSymbol(symbolToSell, symbolToBuy);

        this.logger.info(`${side} ${symbol} on Binance. Amount: ${amountToSell}`);

        const response = await this.binanceClient.order({
            symbol,
            side,
            quantity: amountToSell.humanReadableAmount.toString(), // TODO: check if we need to invert amount in some cases
            type: 'MARKET',
        });

        if (response.status !== 'FILLED') {
            throw new InvariantViolationError(
                `Invalid order status ${response.status} when selling ${amountToSell} for ${symbolToBuy}: ${response.status}`,
            );
        }

        this.logger.info(`Trade successful: price: ${response.price}, id: ${response.clientOrderId}`);

        return response;
    }

    private getBinanceSymbol(baseToken: TokenSymbol, quoteToken: TokenSymbol): { symbol: string; side: OrderSide } {
        const parsedBaseSymbol = this.parseSymbol(baseToken);
        const parsedQuoteSymbol = this.parseSymbol(quoteToken);

        if (availableMarkets.includes(parsedBaseSymbol + parsedQuoteSymbol)) {
            return {
                symbol: parsedBaseSymbol + parsedQuoteSymbol,
                side: 'SELL',
            };
        } else if (availableMarkets.includes(parsedQuoteSymbol + parsedBaseSymbol)) {
            return {
                symbol: parsedQuoteSymbol + parsedBaseSymbol,
                side: 'BUY',
            };
        }

        throw new InvariantViolationError(`Unsupported market: ${parsedBaseSymbol}${parsedQuoteSymbol}`);
    }

    private parseSymbol = (token: TokenSymbol) => token === TokenSymbol.WETH ? 'ETH' : token;
}