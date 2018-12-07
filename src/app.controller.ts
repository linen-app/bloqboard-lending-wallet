import { Get, Controller, Post, Query, Res, HttpStatus } from '@nestjs/common';
import { CompoundService } from './compound.service';
import { TokenService } from './token.service';
import { ApiImplicitQuery } from '@nestjs/swagger';
import { TokenSymbol } from './types';
import { ParseBooleanPipe } from './parseBoolean.pipe';

@Controller()
export class AppController {
    constructor(
        private readonly compoundService: CompoundService,
        private readonly tokenService: TokenService,
    ) { }

    @Get('token-balance')
    @ApiImplicitQuery({ name: 'token', enum: ['WETH', 'DAI', 'ZRX', 'REP', 'BAT'] })
    async tokenBalance(@Query('token') token: TokenSymbol): Promise<any> {
        const rawBalance = await this.tokenService.getTokenBalance(token);
        const result = this.tokenService.toHumanReadable(rawBalance, token);
        return { amount: result, token };
    }

    @Get('supply-balance')
    @ApiImplicitQuery({ name: 'token', enum: ['WETH', 'DAI', 'ZRX', 'REP', 'BAT'] })
    async supplyBalance(@Query('token') token: TokenSymbol): Promise<any> {
        const rawBalance = await this.compoundService.getSupplyBalance(token);
        const result = this.tokenService.toHumanReadable(rawBalance, token);
        return { amount: result, token };
    }

    @Get('borrow-balance')
    @ApiImplicitQuery({ name: 'token', enum: ['WETH', 'DAI', 'ZRX', 'REP', 'BAT'] })
    async borrowBalance(@Query('token') token: TokenSymbol): Promise<any> {
        const rawBalance = await this.compoundService.getBorrowBalance(token);
        const result = this.tokenService.toHumanReadable(rawBalance, token);
        return { amount: result, token };
    }

    @Get('account-liquidity')
    async accountLiquidity(): Promise<any> {
        const rawBalance = await this.compoundService.getAccountLiquidity();
        const result = this.tokenService.toHumanReadable(rawBalance, TokenSymbol.WETH);
        return { amount: result, token: 'ETH' };
    }

    @Post('supply')
    @ApiImplicitQuery({ name: 'token', enum: ['WETH', 'DAI', 'ZRX', 'REP', 'BAT'] })
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
    @ApiImplicitQuery({ name: 'token', enum: ['WETH', 'DAI', 'ZRX', 'REP', 'BAT'] })
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
    @ApiImplicitQuery({ name: 'token', enum: ['WETH', 'DAI', 'ZRX', 'REP', 'BAT'] })
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
    @ApiImplicitQuery({ name: 'token', enum: ['WETH', 'DAI', 'ZRX', 'REP', 'BAT'] })
    async repayBorrow(
        @Query('token') token: TokenSymbol,
        @Query('amount') amount: string,
        @Query('needAwaitMining', ParseBooleanPipe) needAwaitMining: boolean = true,
        @Res() res,
    ): Promise<string> {
        const rawAmount = this.tokenService.fromHumanReadable(amount, token);
        const result = await this.compoundService.repayBorrow(token, rawAmount, needAwaitMining);
        return res.status(HttpStatus.CREATED).json(result);
    }
}
