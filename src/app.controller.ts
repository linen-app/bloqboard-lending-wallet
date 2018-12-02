import { Get, Controller, Post, Query } from '@nestjs/common';
import { AppService } from './app.service';
import { TokenService } from './token.service';
import { ApiImplicitQuery } from '@nestjs/swagger';

@Controller()
export class AppController {
    constructor(
        private readonly appService: AppService,
        private readonly tokenService: TokenService,
    ) { }

    @Get('supply-balance')
    @ApiImplicitQuery({ name: 'token', enum: ['WETH', 'DAI', 'ZRX', 'REP', 'BAT'] })
    supplyBalance(@Query('token') token: string): Promise<string> {
        const tokenMetadata = this.tokenService.getTokenBySymbol(token);
        return this.appService.getSupplyBalance(tokenMetadata.address).then(x => x + ` ${token}\n`);
    }

    @Get('borrow-balance')
    @ApiImplicitQuery({ name: 'token', enum: ['WETH', 'DAI', 'ZRX', 'REP', 'BAT'] })
    borrowBalance(@Query('token') token: string): Promise<string> {
        const tokenMetadata = this.tokenService.getTokenBySymbol(token);
        return this.appService.getBorrowBalance(tokenMetadata.address).then(x => x + ` ${token}\n`);
    }

    @Get('account-liquidity')
    accountLiquidity(): Promise<string> {
        return this.appService.getAccountLiquidity().then(x => x + ` ETH\n`);
    }

    @Post('supply')
    @ApiImplicitQuery({ name: 'token', enum: ['WETH', 'DAI', 'ZRX', 'REP', 'BAT'] })
    supply(
        @Query('token') token: string,
        @Query('amount') amount: string,
        @Query('needAwaitMining') needAwaitMining: boolean = false,
    ): Promise<string> {
        const tokenMetadata = this.tokenService.getTokenBySymbol(token);
        return this.appService.supply(tokenMetadata.address, amount, needAwaitMining).then(x => x + '\n');
    }

    @Post('withdraw')
    @ApiImplicitQuery({ name: 'token', enum: ['WETH', 'DAI', 'ZRX', 'REP', 'BAT'] })
    withdraw(
        @Query('token') token: string,
        @Query('amount') amount: string,
        @Query('needAwaitMining') needAwaitMining: boolean = false,
    ): Promise<string> {
        const tokenMetadata = this.tokenService.getTokenBySymbol(token);
        return this.appService.withdraw(tokenMetadata.address, amount, needAwaitMining).then(x => x + '\n');
    }

    @Post('borrow')
    @ApiImplicitQuery({ name: 'token', enum: ['WETH', 'DAI', 'ZRX', 'REP', 'BAT'] })
    borrow(
        @Query('token') token: string,
        @Query('amount') amount: string,
        @Query('needAwaitMining') needAwaitMining: boolean = false,
    ): Promise<string> {
        const tokenMetadata = this.tokenService.getTokenBySymbol(token);
        return this.appService.borrow(tokenMetadata.address, amount, needAwaitMining).then(x => x + '\n');
    }

    @Post('repay-borrow')
    @ApiImplicitQuery({ name: 'token', enum: ['WETH', 'DAI', 'ZRX', 'REP', 'BAT'] })
    repayBorrow(
        @Query('token') token: string,
        @Query('amount') amount: string,
        @Query('needAwaitMining') needAwaitMining: boolean = false,
    ): Promise<string> {
        const tokenMetadata = this.tokenService.getTokenBySymbol(token);
        return this.appService.repayBorrow(tokenMetadata.address, amount, needAwaitMining).then(x => x + '\n');
    }
}
