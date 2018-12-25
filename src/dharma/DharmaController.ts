import { Get, Controller, Post, Query, Res, HttpStatus, Param } from '@nestjs/common';
import { ParseBooleanPipe } from '../parseBoolean.pipe';
import { DharmaDebtRequestService } from './DharmaDebtRequestService';
import { ApiImplicitQuery, ApiUseTags } from '@nestjs/swagger';
import { DharmaLendOffersService } from './DharmaLendOffersService';
import { ParseNumberPipe } from '../parseNumber.pipe';
import { TokenSymbol } from 'src/tokens/TokenSymbol';

const supportedTokens: TokenSymbol[] = [TokenSymbol.WETH, TokenSymbol.DAI, TokenSymbol.ZRX, TokenSymbol.REP, TokenSymbol.BAT];

@Controller('dharma')
@ApiUseTags('Dharma @ Bloqboard')
export class DharmaController {
    constructor(
        private readonly dharmaLoanRequestsService: DharmaDebtRequestService,
        private readonly dharmaLendOffersService: DharmaLendOffersService,
    ) { }

    @Get('debt-requests')
    @ApiImplicitQuery({ name: 'principalToken', enum: supportedTokens, required: false })
    @ApiImplicitQuery({ name: 'collateralToken', enum: supportedTokens, required: false })
    @ApiImplicitQuery({ name: 'minUsdAmount', required: false })
    @ApiImplicitQuery({ name: 'maxUsdAmount', required: false })
    async getDebtRequests(
        @Query('maxUsdAmount', ParseNumberPipe) maxUsdAmount: number,
        @Query('minUsdAmount', ParseNumberPipe) minUsdAmount: number,
        @Query('collateralToken') collateralToken: TokenSymbol,
        @Query('principalToken') principalToken: TokenSymbol,
    ): Promise<any> {
        const debtRequests = await this.dharmaLoanRequestsService.getDebtOrders(principalToken, collateralToken, minUsdAmount, maxUsdAmount);

        return debtRequests;
    }

    @Get('my-loaned-assets')
    async getMyLoanedAssets(): Promise<any> {
        const offers = await this.dharmaLoanRequestsService.getMyLoanedOrders();

        return offers;
    }

    @Post('fill-debt-request/:debtRequestId')
    @ApiImplicitQuery({ name: 'needAwaitMining', required: false })
    async fillDebtRequest(
        @Param('debtRequestId') debtRequestId: string,
        @Query('needAwaitMining', ParseBooleanPipe) needAwaitMining: boolean = true,
        @Res() res,
    ): Promise<any> {
        const result = await this.dharmaLoanRequestsService.fillDebtRequest(debtRequestId, needAwaitMining);
        return res.status(HttpStatus.CREATED).json(result);
    }

    @Get('lend-offers')
    @ApiImplicitQuery({ name: 'principalToken', enum: supportedTokens, required: false })
    @ApiImplicitQuery({ name: 'collateralToken', enum: supportedTokens, required: false })
    @ApiImplicitQuery({ name: 'minUsdAmount', required: false })
    @ApiImplicitQuery({ name: 'maxUsdAmount', required: false })
    async getLendOffers(
        @Query('maxUsdAmount', ParseNumberPipe) maxUsdAmount: number,
        @Query('minUsdAmount', ParseNumberPipe) minUsdAmount: number,
        @Query('collateralToken') collateralToken: TokenSymbol,
        @Query('principalToken') principalToken: TokenSymbol,
    ): Promise<any> {
        const offers = await this.dharmaLendOffersService.getLendOffers(principalToken, collateralToken, minUsdAmount, maxUsdAmount);

        return offers;
    }

    @Get('my-borrowed-assets')
    async getMyBorrowedAssets(): Promise<any> {
        const offers = await this.dharmaLendOffersService.getMyBorrowedOrders();

        return offers;
    }

    @Post('fill-lend-offer/:lendOfferId')
    @ApiImplicitQuery({ name: 'needAwaitMining', required: false })
    async fillLendOffer(
        @Param('lendOfferId') lendOfferId: string,
        @Query('needAwaitMining', ParseBooleanPipe) needAwaitMining: boolean = true,
        @Res() res,
    ): Promise<any> {
        const result = await this.dharmaLendOffersService.fillLendOffer(lendOfferId, needAwaitMining);
        return res.status(HttpStatus.CREATED).json(result);
    }

    @Post('repay-lend-offer/:lendOfferId')
    @ApiImplicitQuery({ name: 'needAwaitMining', required: false })
    async repayLendOffer(
        @Param('lendOfferId') lendOfferId: string,
        @Query('needAwaitMining', ParseBooleanPipe) needAwaitMining: boolean = true,
        @Query('amount', ParseNumberPipe) amount: number,
        @Res() res,
    ): Promise<any> {
        const result = await this.dharmaLendOffersService.repayLendOffer(lendOfferId, amount, needAwaitMining);
        return res.status(HttpStatus.CREATED).json(result);
    }

    @Post('return-collateral/:lendOfferId')
    @ApiImplicitQuery({ name: 'needAwaitMining', required: false })
    async returnCollateral(
        @Param('lendOfferId') lendOfferId: string,
        @Query('needAwaitMining', ParseBooleanPipe) needAwaitMining: boolean = true,
        @Res() res,
    ): Promise<any> {
        const result = await this.dharmaLendOffersService.returnCollateral(lendOfferId, needAwaitMining);
        return res.status(HttpStatus.CREATED).json(result);
    }
}
