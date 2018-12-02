import { Get, Controller, Post, Param, Query, Inject } from '@nestjs/common';
import { AppService } from './app.service';
import { TokenService } from './token.service';

@Controller()
export class AppController {
    constructor(
        private readonly appService: AppService,
        private readonly tokenService: TokenService,
    ) { }

    @Get('balance')
    balance(@Query('token') token): Promise<string> {
        const tokenMetadata = this.tokenService.getTokenBySymbol(token);
        return this.appService.balance(tokenMetadata.address).then(x => x + ` ${token}\n`);
    }

    @Post('supply')
    supply(@Query('token') token, @Query('amount') amount, @Query('needAwait') needAwait): Promise<string> {
        const tokenMetadata = this.tokenService.getTokenBySymbol(token);
        return this.appService.supply(tokenMetadata.address, amount, needAwait).then(x => x + '\n');
    }

    @Post('withdraw')
    withdraw(@Query('token') token, @Query('amount') amount, @Query('needAwait') needAwait): Promise<string> {
        const tokenMetadata = this.tokenService.getTokenBySymbol(token);
        return this.appService.withdraw(tokenMetadata.address, amount, needAwait).then(x => x + '\n');
    }
}
