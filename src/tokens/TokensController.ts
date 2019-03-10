import { Get, Controller, Query, Post, Res, HttpStatus, Inject } from '@nestjs/common';
import { ApiImplicitQuery, ApiUseTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TokenService } from './TokenService';
import { TokenSymbol } from './TokenSymbol';
import * as Text from '../../resources/ConstantText';
import { ParseBooleanPipe } from '../parseBoolean.pipe';
import { TransactionLog } from '../common-models/TransactionLog';
import { ParseNumberPipe } from '../parseNumber.pipe';
import { WrappedEtherService } from './WrappedEtherService';
import { Wallet } from 'ethers';
import { TokenAmount } from './TokenAmount';

const supportedTokens: (TokenSymbol)[] = [TokenSymbol.WETH, TokenSymbol.DAI, TokenSymbol.ZRX, TokenSymbol.REP, TokenSymbol.BAT];

@Controller('tokens')
@ApiUseTags('Wallet')
export class TokensController {
    constructor(
        @Inject('wallet') private readonly wallet: Wallet,
        private readonly tokenService: TokenService,
        private readonly wrappedEtherService: WrappedEtherService,
    ) { }

    @Get('balance')
    @ApiOperation({ title: 'Return token balance of the current account' })
    @ApiImplicitQuery({
        name: 'token',
        enum: supportedTokens,
        required: false,
        description: Text.SUPPORTED_TOKEND,
    })
    async tokenBalance(@Query('token') token: TokenSymbol): Promise<any> {
        const tokens = token ? [token] : supportedTokens;
        const promises = tokens.map(x => this.tokenService.getTokenBalance(x));
        const result = {};

        const ethBalance = new TokenAmount(await this.wallet.getBalance(), this.tokenService.getTokenBySymbol(TokenSymbol.WETH));
        // tslint:disable-next-line:no-string-literal
        result['ETH'] = ethBalance.humanReadableAmount;

        for (const amountPromise of promises) {
            const amount = await amountPromise;
            result[amount.token.symbol] = amount.humanReadableAmount;
        }

        return result;
    }

    @Post('wrap')
    @ApiOperation({
        title: 'Wraps ETH into WETH',
    })
    @ApiResponse({ status: HttpStatus.CREATED, type: TransactionLog })
    @ApiImplicitQuery({ name: 'needAwaitMining', required: false, description: Text.NEED_AWAIT_MINING })
    async wrap(
        @Query('amount', ParseNumberPipe) amount: number,
        @Query('needAwaitMining', ParseBooleanPipe) needAwaitMining: boolean = true,
        @Res() res,
    ): Promise<string> {
        const result = await this.wrappedEtherService.wrapEth(amount, needAwaitMining);
        return res.status(HttpStatus.CREATED).json(result);
    }

    @Post('unwrap')
    @ApiOperation({
        title: 'Unwraps WETH into ETH',
    })
    @ApiResponse({ status: HttpStatus.CREATED, type: TransactionLog })
    @ApiImplicitQuery({ name: 'needAwaitMining', required: false, description: Text.NEED_AWAIT_MINING })
    @ApiImplicitQuery({ name: 'amount', description: '"-1" will unwrap all balance' })
    async unwrap(
        @Query('amount', ParseNumberPipe) amount: number,
        @Query('needAwaitMining', ParseBooleanPipe) needAwaitMining: boolean = true,
        @Res() res,
    ): Promise<string> {
        const result = await this.wrappedEtherService.unwrapEth(amount, needAwaitMining);
        return res.status(HttpStatus.CREATED).json(result);
    }
}