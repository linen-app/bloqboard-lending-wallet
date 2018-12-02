import { Get, Controller, Post, Query } from '@nestjs/common';
import { AppService } from './app.service';
import { TokenService } from './token.service';
import { ApiImplicitQuery } from '@nestjs/swagger';
import { TokenSymbol } from './token.entity';

@Controller()
export class AppController {
    constructor(
        private readonly appService: AppService,
        private readonly tokenService: TokenService,
    ) { }

    @Get('token-balance')
    @ApiImplicitQuery({ name: 'token', enum: ['WETH', 'DAI', 'ZRX', 'REP', 'BAT'] })
    tokenBalance(@Query('token') token: TokenSymbol): Promise<string> {
        return this.tokenService.getTokenBalance(token).then(x => x + ` ${token}\n`);
    }

    @Get('supply-balance')
    @ApiImplicitQuery({ name: 'token', enum: ['WETH', 'DAI', 'ZRX', 'REP', 'BAT'] })
    supplyBalance(@Query('token') token: TokenSymbol): Promise<string> {
        return this.appService.getSupplyBalance(token).then(x => x + ` ${token}\n`);
    }

    @Get('borrow-balance')
    @ApiImplicitQuery({ name: 'token', enum: ['WETH', 'DAI', 'ZRX', 'REP', 'BAT'] })
    borrowBalance(@Query('token') token: TokenSymbol): Promise<string> {
        return this.appService.getBorrowBalance(token).then(x => x + ` ${token}\n`);
    }

    @Get('account-liquidity')
    accountLiquidity(): Promise<string> {
        return this.appService.getAccountLiquidity().then(x => x + ` ETH\n`);
    }

    @Post('supply')
    @ApiImplicitQuery({ name: 'token', enum: ['WETH', 'DAI', 'ZRX', 'REP', 'BAT'] })
    supply(
        @Query('token') token: TokenSymbol,
        @Query('amount') amount: string,
        @Query('needAwaitMining') needAwaitMining: boolean = false,
    ): Promise<string> {
        return this.appService.supply(token, amount, needAwaitMining).then(x => x + '\n');
    }

    @Post('withdraw')
    @ApiImplicitQuery({ name: 'token', enum: ['WETH', 'DAI', 'ZRX', 'REP', 'BAT'] })
    withdraw(
        @Query('token') token: TokenSymbol,
        @Query('amount') amount: string,
        @Query('needAwaitMining') needAwaitMining: boolean = false,
    ): Promise<string> {
        return this.appService.withdraw(token, amount, needAwaitMining).then(x => x + '\n');
    }

    @Post('borrow')
    @ApiImplicitQuery({ name: 'token', enum: ['WETH', 'DAI', 'ZRX', 'REP', 'BAT'] })
    borrow(
        @Query('token') token: TokenSymbol,
        @Query('amount') amount: string,
        @Query('needAwaitMining') needAwaitMining: boolean = false,
    ): Promise<string> {
        return this.appService.borrow(token, amount, needAwaitMining).then(x => x + '\n');
    }

    @Post('repay-borrow')
    @ApiImplicitQuery({ name: 'token', enum: ['WETH', 'DAI', 'ZRX', 'REP', 'BAT'] })
    repayBorrow(
        @Query('token') token: TokenSymbol,
        @Query('amount') amount: string,
        @Query('needAwaitMining') needAwaitMining: boolean = false,
    ): Promise<string> {
        return this.appService.repayBorrow(token, amount, needAwaitMining).then(x => x + '\n');
    }
}
