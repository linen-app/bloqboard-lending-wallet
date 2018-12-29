import { Get, Controller, Post, Query, Res, HttpStatus, Param } from '@nestjs/common';
import { ParseBooleanPipe } from '../parseBoolean.pipe';
import { DharmaDebtRequestService } from './DharmaDebtRequestService';
import { ApiImplicitQuery, ApiUseTags, ApiOperation, ApiResponse, ApiImplicitParam } from '@nestjs/swagger';
import { DharmaLendOffersService } from './DharmaLendOffersService';
import { ParseNumberPipe } from '../parseNumber.pipe';
import { ParseNullableNumberPipe } from '../parseNullableNumber.pipe';
import { ParsePaginationPipe } from '../parsePagination.pipe';
import { TokenSymbol } from '../tokens/TokenSymbol';
import { TransactionLog } from '../common-models/TransactionLog';
import * as Text from '../../resources/ConstantText';
import { HumanReadableDebtRequest } from './HumanReadableDebtRequest';
import { HumanReadableLendOffer } from './HumanReadableLendOffer';
import { Pagination } from 'src/common-models/Pagination';

const supportedTokens: TokenSymbol[] = [TokenSymbol.WETH, TokenSymbol.DAI, TokenSymbol.ZRX, TokenSymbol.REP, TokenSymbol.BAT];

@Controller('dharma')
@ApiUseTags('Dharma @ Bloqboard')
export class DharmaController {
    constructor(
        private readonly dharmaLoanRequestsService: DharmaDebtRequestService,
        private readonly dharmaLendOffersService: DharmaLendOffersService,
    ) { }

    @Get('debt-requests')
    @ApiOperation({ title: 'Return list of open debt requests from Bloqboard Dharma Relayer API' })
    @ApiImplicitQuery({ name: 'principalToken', enum: supportedTokens, required: false, description: 'filter by principal token' })
    @ApiImplicitQuery({ name: 'collateralToken', enum: supportedTokens, required: false, description: 'filter by collateral token' })
    @ApiImplicitQuery({ name: 'minUsdAmount', required: false, description: 'minimal amout in USD for principal in returned request' })
    @ApiImplicitQuery({ name: 'maxUsdAmount', required: false, description: 'maximal amout in USD for principal in returned request' })
    @ApiResponse({ status: HttpStatus.OK, type: HumanReadableDebtRequest, isArray: true })
    async getDebtRequests(
        @Query('maxUsdAmount', ParseNullableNumberPipe) maxUsdAmount: number,
        @Query('minUsdAmount', ParseNullableNumberPipe) minUsdAmount: number,
        @Query('collateralToken') collateralToken: TokenSymbol,
        @Query('principalToken') principalToken: TokenSymbol,
        @Query(ParsePaginationPipe) pagination: Pagination,
    ): Promise<HumanReadableDebtRequest[]> {
        pagination = { ...Pagination.default, ...pagination };
        const debtRequests = await this.dharmaLoanRequestsService.getDebtOrders(
            pagination,
            principalToken,
            collateralToken,
            minUsdAmount,
            maxUsdAmount,
        );

        return debtRequests;
    }

    @Get('my-filled-debt-requests')
    @ApiOperation({
        title: 'Return list of my loaned debt requests',
        description: 'List of debt requests from Bloqboard Dharma Relayer API, that were filled from the current account.',
    })
    @ApiResponse({ status: HttpStatus.OK, type: HumanReadableDebtRequest, isArray: true })
    async getMyLoanedAssets(@Query() pagination: Pagination): Promise<HumanReadableDebtRequest[]> {
        pagination = { ...Pagination.default, ...pagination };
        const offers = await this.dharmaLoanRequestsService.getMyLoanedOrders(pagination);

        return offers;
    }

    @Post('fill-debt-request/:debtRequestId')
    @ApiOperation({
        title: 'Lend tokens by filling a debt request',
        description: 'Fills specified debt request. Automatically unlocks principal token if needed.',
    })
    @ApiImplicitParam({ name: 'debtRequestId', description: 'debt request ID from Bloqboard API' })
    @ApiImplicitQuery({ name: 'needAwaitMining', description: Text.NEED_AWAIT_MINING })
    @ApiResponse({ status: HttpStatus.CREATED, type: TransactionLog })
    async fillDebtRequest(
        @Param('debtRequestId') debtRequestId: string,
        @Query('needAwaitMining', ParseBooleanPipe) needAwaitMining: boolean = true,
        @Res() res,
    ): Promise<any> {
        const result = await this.dharmaLoanRequestsService.fillDebtRequest(debtRequestId, needAwaitMining);
        return res.status(HttpStatus.CREATED).json(result);
    }

    @Get('lend-offers')
    @ApiOperation({ title: 'Return list of open lend offers from Bloqboard Dharma Relayer API' })
    @ApiImplicitQuery({ name: 'principalToken', enum: supportedTokens, required: false, description: 'filter by principal token' })
    @ApiImplicitQuery({ name: 'collateralToken', enum: supportedTokens, required: false, description: 'filter by collateral token' })
    @ApiImplicitQuery({ name: 'minUsdAmount', required: false, description: 'minimal amout in USD for principal in returned offer' })
    @ApiImplicitQuery({ name: 'maxUsdAmount', required: false, description: 'maximal amout in USD for principal in returned offer' })
    @ApiResponse({ status: HttpStatus.OK, type: HumanReadableLendOffer, isArray: true })
    async getLendOffers(
        @Query('maxUsdAmount', ParseNullableNumberPipe) maxUsdAmount: number,
        @Query('minUsdAmount', ParseNullableNumberPipe) minUsdAmount: number,
        @Query('collateralToken') collateralToken: TokenSymbol,
        @Query('principalToken') principalToken: TokenSymbol,
        @Query(ParsePaginationPipe) pagination: Pagination,
    ): Promise<HumanReadableLendOffer[]> {
        pagination = { ...Pagination.default, ...pagination };
        const offers = await this.dharmaLendOffersService.getLendOffers(pagination, principalToken, collateralToken, minUsdAmount, maxUsdAmount);

        return offers;
    }

    @Get('my-filled-lend-offers')
    @ApiOperation({
        title: 'Return list of my borrowed lend offers',
        description: 'List of lend offers from Bloqboard Dharma Relayer API, that were filled from the current account.',
    })
    @ApiResponse({ status: HttpStatus.OK, type: HumanReadableDebtRequest, isArray: true })
    async getMyBorrowedAssets(@Query() pagination: Pagination): Promise<HumanReadableDebtRequest[]> {
        pagination = { ...Pagination.default, ...pagination };
        const offers = await this.dharmaLendOffersService.getMyBorrowedOrders(pagination);

        return offers;
    }

    @Post('fill-lend-offer/:lendOfferId')
    @ApiOperation({
        title: 'Borrow tokens by filling a offer-to-lend',
        description: 'Fills specified offer to lend. Automatically unlocks collateral token if needed.',
    })
    @ApiImplicitParam({ name: 'lendOfferId', description: 'lend offer ID from Bloqboard API' })
    @ApiImplicitQuery({ name: 'needAwaitMining', description: Text.NEED_AWAIT_MINING })
    @ApiResponse({ status: HttpStatus.CREATED, type: TransactionLog })
    async fillLendOffer(
        @Param('lendOfferId') lendOfferId: string,
        @Query('needAwaitMining', ParseBooleanPipe) needAwaitMining: boolean = true,
        @Res() res,
    ): Promise<any> {
        const result = await this.dharmaLendOffersService.fillLendOffer(lendOfferId, needAwaitMining);
        return res.status(HttpStatus.CREATED).json(result);
    }

    @Post('repay-lend-offer/:lendOfferId')
    @ApiOperation({
        title: 'Repay filled lend offers',
        description: 'Fills specified offer to lend. Unlocks collateral token if needed.',
    })
    @ApiImplicitParam({ name: 'lendOfferId', description: 'lend offer ID from Bloqboard API' })
    @ApiImplicitQuery({ name: 'amount', description: Text.REPAY_AMOUNT })
    @ApiImplicitQuery({ name: 'needAwaitMining', required: false, description: Text.NEED_AWAIT_MINING })
    @ApiResponse({ status: HttpStatus.CREATED, type: TransactionLog })
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
    @ApiOperation({
        title: 'Return collateral',
        description: 'Returns collateral of specified loan, if it is already repaid.',
    })
    @ApiImplicitParam({ name: 'lendOfferId', description: 'lend offer ID from Bloqboard API' })
    @ApiImplicitQuery({ name: 'needAwaitMining', required: false, description: Text.NEED_AWAIT_MINING })
    @ApiResponse({ status: HttpStatus.CREATED, type: TransactionLog })
    async returnCollateral(
        @Param('lendOfferId') lendOfferId: string,
        @Query('needAwaitMining', ParseBooleanPipe) needAwaitMining: boolean = true,
        @Res() res,
    ): Promise<any> {
        const result = await this.dharmaLendOffersService.returnCollateral(lendOfferId, needAwaitMining);
        return res.status(HttpStatus.CREATED).json(result);
    }
}
