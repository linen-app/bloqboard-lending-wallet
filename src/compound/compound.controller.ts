import { Get, Controller, Post, Query, Res, HttpStatus } from '@nestjs/common';
import { CompoundService } from './compound.service';
import { TokenService } from '../token.service';
import { ApiImplicitQuery } from '@nestjs/swagger';
import { TokenSymbol } from '../types';
import { ParseBooleanPipe } from '../parseBoolean.pipe';

const supportedTokens: TokenSymbol[] = [TokenSymbol.WETH, TokenSymbol.DAI, TokenSymbol.ZRX, TokenSymbol.REP, TokenSymbol.BAT];

@Controller()
export class CompoundController {
    constructor(
        private readonly compoundService: CompoundService,
        private readonly tokenService: TokenService,
    ) { }

    @Get('token-balance')
    @ApiImplicitQuery({ name: 'token', enum: supportedTokens, required: false })
    async tokenBalance(@Query('token') token: TokenSymbol): Promise<any> {
        const tokens = token ? [token] : supportedTokens;
        const result = {};
        for (const t of tokens) {
            const rawBalance = await this.tokenService.getTokenBalance(t);
            const balance = this.tokenService.toHumanReadable(rawBalance, t);
            result[t] = balance;
        }
        return result;
    }

    @Get('supply-balance')
    @ApiImplicitQuery({ name: 'token', enum: supportedTokens, required: false })
    async supplyBalance(@Query('token') token: TokenSymbol): Promise<any> {
        const tokens = token ? [token] : supportedTokens;
        const result = {};
        for (const t of tokens) {
            const rawBalance = await this.compoundService.getSupplyBalance(t);
            const balance = this.tokenService.toHumanReadable(rawBalance, t);
            result[t] = balance;
        }
        return result;
    }

    @Get('borrow-balance')
    @ApiImplicitQuery({ name: 'token', enum: supportedTokens, required: false })
    async borrowBalance(@Query('token') token: TokenSymbol): Promise<any> {
        const tokens = token ? [token] : supportedTokens;
        const result = {};
        for (const t of tokens) {
            const rawBalance = await this.compoundService.getBorrowBalance(t);
            const balance = this.tokenService.toHumanReadable(rawBalance, t);
            result[t] = balance;
        }
        return result;
    }

    @Get('account-liquidity')
    async accountLiquidity(): Promise<any> {
        const rawBalance = await this.compoundService.getAccountLiquidity();
        const result = this.tokenService.toHumanReadable(rawBalance, TokenSymbol.WETH);
        return { amount: result, token: 'ETH' };
    }

    @Post('supply')
    @ApiImplicitQuery({ name: 'token', enum: supportedTokens })
    async supply(
        @Query('token') token: TokenSymbol,
        @Query('amount') amount: string,
        @Query('needAwaitMining', ParseBooleanPipe) needAwaitMining: boolean = true,
        @Res() res,
    ): Promise<string> {
        const rawAmount = this.tokenService.fromHumanReadable(amount, token);
        const result = await this.compoundService.supply(token, rawAmount, needAwaitMining);
        return res.status(HttpStatus.CREATED).json(result);
    }

    @Post('withdraw')
    @ApiImplicitQuery({ name: 'token', enum: supportedTokens })
    async withdraw(
        @Query('token') token: TokenSymbol,
        @Query('amount') amount: string,
        @Query('needAwaitMining', ParseBooleanPipe) needAwaitMining: boolean = true,
        @Res() res,
    ): Promise<string> {
        const rawAmount = this.tokenService.fromHumanReadable(amount, token);
        const result = await this.compoundService.withdraw(token, rawAmount, needAwaitMining);
        return res.status(HttpStatus.CREATED).json(result);
    }

    @Post('borrow')
    @ApiImplicitQuery({ name: 'token', enum: supportedTokens })
    async borrow(
        @Query('token') token: TokenSymbol,
        @Query('amount') amount: string,
        @Query('needAwaitMining', ParseBooleanPipe) needAwaitMining: boolean = true,
        @Res() res,
    ): Promise<string> {
        const rawAmount = this.tokenService.fromHumanReadable(amount, token);
        const result = await this.compoundService.borrow(token, rawAmount, needAwaitMining);
        return res.status(HttpStatus.CREATED).json(result);
    }

    @Post('repay-borrow')
    @ApiImplicitQuery({ name: 'token', enum: supportedTokens })
    async repayBorrow(
        @Query('token') token: TokenSymbol,
        @Query('amount') amount: string,
        @Query('utilizeOtherTokens', ParseBooleanPipe) utilizeOtherTokens: boolean,
        @Query('needAwaitMining', ParseBooleanPipe) needAwaitMining: boolean = true,
        @Res() res,
    ): Promise<string> {
        const rawAmount = this.tokenService.fromHumanReadable(amount, token);
        const result = await this.compoundService.repayBorrow(token, rawAmount, utilizeOtherTokens, needAwaitMining);
        return res.status(HttpStatus.CREATED).json(result);
    }
}
