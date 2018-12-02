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

    @Get('balance')
    @ApiImplicitQuery({ name: 'token', enum: ['WETH', 'DAI', 'ZRX', 'REP', 'BAT'] })
    balance(@Query('token') token: string): Promise<string> {
        const tokenMetadata = this.tokenService.getTokenBySymbol(token);
        return this.appService.balance(tokenMetadata.address).then(x => x + ` ${token}\n`);
    }

    @Post('supply')
    @ApiImplicitQuery({ name: 'token', enum: ['WETH', 'DAI', 'ZRX', 'REP', 'BAT'] })
    supply(
        @Query('token') token: string,
        @Query('amount') amount: string,
        @Query('needAwait') needAwait: boolean = false,
    ): Promise<string> {
        const tokenMetadata = this.tokenService.getTokenBySymbol(token);
        return this.appService.supply(tokenMetadata.address, amount, needAwait).then(x => x + '\n');
    }

    @Post('withdraw')
    @ApiImplicitQuery({ name: 'token', enum: ['WETH', 'DAI', 'ZRX', 'REP', 'BAT'] })
    withdraw(
        @Query('token') token: string,
        @Query('amount') amount: string,
        @Query('needAwait') needAwait: boolean = false,
    ): Promise<string> {
        const tokenMetadata = this.tokenService.getTokenBySymbol(token);
        return this.appService.withdraw(tokenMetadata.address, amount, needAwait).then(x => x + '\n');
    }
}
