import { Agent } from 'https';
import { Inject, Injectable } from '@nestjs/common';
import { RelayerDebtOrder, Status } from './models/RelayerDebtOrder';
import Axios from 'axios';
import { TokenSymbol, Address } from 'src/types';
import { TokenService } from 'src/tokens/TokenService';
import { stringify } from 'qs';
import { Logger } from 'winston';

@Injectable()
export class DharmaOrdersFetcher {
    constructor(
        @Inject('bloqboard-uri') private readonly bloqboardUri: string,
        @Inject('dharma-kernel-address') private readonly dharmaKernelAddress: Address,
        @Inject('winston') private readonly logger: Logger,
        private readonly tokenService: TokenService,
    )
    {}
    async fetchOrder(offerId: string): Promise<RelayerDebtOrder> {
        const debtsUrl = `${this.bloqboardUri}/Debts`;
        const response = await Axios.get(`${debtsUrl}/${offerId}`, {
            httpsAgent: new Agent({ rejectUnauthorized: false }),
        });

        return response.data;
    }

    async fetchOrders(
        status: Status,
        principalTokenSymbol?: TokenSymbol,
        collateralTokenSymbol?: TokenSymbol,
        minUsdAmount?: number,
        maxUsdAmount?: number,
    ): Promise<RelayerDebtOrder[]> {
        const debtsUrl = `${this.bloqboardUri}/Debts`;
        const kernelAddress = this.dharmaKernelAddress;
        const pagination = {};
        const sorting = {};

        const principalToken = principalTokenSymbol && this.tokenService.getTokenBySymbol(principalTokenSymbol);
        const collateralToken = collateralTokenSymbol && this.tokenService.getTokenBySymbol(collateralTokenSymbol);

        const filter = {
            // principalTokenAddresses: principalTokenAddress && [principalTokenAddress],
            // collateralTokenAddresses: collateralTokenAddress && [collateralTokenAddress],
            amountFrom: minUsdAmount,
            amountTo: maxUsdAmount,
        };

        const response = await Axios.get(debtsUrl, {
            params: {
                status, ...pagination, kernelAddress, ...sorting, ...filter,
            },
            paramsSerializer: (params) => stringify(params, { allowDots: true, arrayFormat: 'repeat' }),
            httpsAgent: new Agent({ rejectUnauthorized: false }),
        });

        this.logger.info(`Recieved ${response.data.length} debt orders from ${response.config.url}${response.request.path}`);

        return response.data;
    }
}