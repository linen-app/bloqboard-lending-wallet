import { Get, Controller, Post, Query, Res, HttpStatus, ParseIntPipe, Param } from '@nestjs/common';
import { ParseBooleanPipe } from '../parseBoolean.pipe';
import { DharmaDebtRequestService } from './DharmaDebtRequestService';
import { ApiImplicitQuery, ApiUseTags } from '@nestjs/swagger';
import { DharmaLendOffersService } from './DharmaLendOffersService';

@Controller('dharma')
@ApiUseTags('Dharma @ Bloqboard')
export class DharmaController {
    constructor(
        private readonly dharmaLoanRequestsService: DharmaDebtRequestService,
        private readonly dharmaLendOffersService: DharmaLendOffersService,
    ) { }

    @Get('debt-orders')
    async getDebtOrders(
        @Query('minUsdAmount', ParseIntPipe) minUsdAmount: number,
        @Query('maxUsdAmount', ParseIntPipe) maxUsdAmount: number,
    ): Promise<any> {
        const debtOrders = await this.dharmaLoanRequestsService.getDebtOrders(null, null, minUsdAmount, maxUsdAmount);

        return debtOrders;
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
    async getLendOffers(
        @Query('minUsdAmount', ParseIntPipe) minUsdAmount: number,
        @Query('maxUsdAmount', ParseIntPipe) maxUsdAmount: number,
    ): Promise<any> {
        const offers = await this.dharmaLendOffersService.getLendOffers(null, null, minUsdAmount, maxUsdAmount);

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
}
