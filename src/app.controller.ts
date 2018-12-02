import { Get, Controller, Post, Query } from '@nestjs/common';
import { CompoundService } from './compound.service';
import { TokenService } from './token.service';
import { ApiImplicitQuery } from '@nestjs/swagger';
import { TokenSymbol } from './types';

@Controller()
export class AppController {
    constructor(
        private readonly compoundService: CompoundService,
        private readonly tokenService: TokenService,
    ) { }

    @Get('token-balance')
    @ApiImplicitQuery({ name: 'token', enum: ['WETH', 'DAI', 'ZRX', 'REP', 'BAT'] })
    async tokenBalance(@Query('token') token: TokenSymbol): Promise<string> {
        const rawBalance = await this.tokenService.getTokenBalance(token);
        const result = this.tokenService.toHumanReadable(rawBalance, token);
        return result + ` ${token}\n`;
    }

    @Get('supply-balance')
    @ApiImplicitQuery({ name: 'token', enum: ['WETH', 'DAI', 'ZRX', 'REP', 'BAT'] })
    async supplyBalance(@Query('token') token: TokenSymbol): Promise<string> {
        const rawBalance = await this.compoundService.getSupplyBalance(token);
        const result = this.tokenService.toHumanReadable(rawBalance, token);
        return result + ` ${token}\n`;
    }

    @Get('borrow-balance')
    @ApiImplicitQuery({ name: 'token', enum: ['WETH', 'DAI', 'ZRX', 'REP', 'BAT'] })
    async borrowBalance(@Query('token') token: TokenSymbol): Promise<string> {
        const rawBalance = await this.compoundService.getBorrowBalance(token);
        const result = this.tokenService.toHumanReadable(rawBalance, token);
        return result + ` ${token}\n`;
    }

    @Get('account-liquidity')
    async accountLiquidity(): Promise<string> {
        const rawBalance = await this.compoundService.getAccountLiquidity();
        const result = this.tokenService.toHumanReadable(rawBalance, TokenSymbol.WETH);
        return result + ` ETH\n`;
    }

    @Post('supply')
    @ApiImplicitQuery({ name: 'token', enum: ['WETH', 'DAI', 'ZRX', 'REP', 'BAT'] })
    supply(
        @Query('token') token: TokenSymbol,
        @Query('amount') amount: string,
        @Query('needAwaitMining') needAwaitMining: boolean = false,
    ): Promise<string> {
        const rawAmount = this.tokenService.fromHumanReadable(amount, token);
        return this.compoundService.supply(token, rawAmount, needAwaitMining).then(x => x + '\n');
    }

    @Post('withdraw')
    @ApiImplicitQuery({ name: 'token', enum: ['WETH', 'DAI', 'ZRX', 'REP', 'BAT'] })
    withdraw(
        @Query('token') token: TokenSymbol,
        @Query('amount') amount: string,
        @Query('needAwaitMining') needAwaitMining: boolean = false,
    ): Promise<string> {
        const rawAmount = this.tokenService.fromHumanReadable(amount, token);
        return this.compoundService.withdraw(token, rawAmount, needAwaitMining).then(x => x + '\n');
    }

    @Post('borrow')
    @ApiImplicitQuery({ name: 'token', enum: ['WETH', 'DAI', 'ZRX', 'REP', 'BAT'] })
    borrow(
        @Query('token') token: TokenSymbol,
        @Query('amount') amount: string,
        @Query('needAwaitMining') needAwaitMining: boolean = false,
    ): Promise<string> {
        const rawAmount = this.tokenService.fromHumanReadable(amount, token);
        return this.compoundService.borrow(token, rawAmount, needAwaitMining).then(x => x + '\n');
    }

    @Post('repay-borrow')
    @ApiImplicitQuery({ name: 'token', enum: ['WETH', 'DAI', 'ZRX', 'REP', 'BAT'] })
    repayBorrow(
        @Query('token') token: TokenSymbol,
        @Query('amount') amount: string,
        @Query('needAwaitMining') needAwaitMining: boolean = false,
    ): Promise<string> {
        const rawAmount = this.tokenService.fromHumanReadable(amount, token);
        return this.compoundService.repayBorrow(token, rawAmount, needAwaitMining).then(x => x + '\n');
    }
}
