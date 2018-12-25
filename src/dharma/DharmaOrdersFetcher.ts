import { Agent } from 'https';
import { Inject, Injectable } from '@nestjs/common';
import { RelayerDebtOrder, Status } from './models/RelayerDebtOrder';
import Axios from 'axios';
import { Address } from 'src/types';
import { TokenService } from '../tokens/TokenService';
import { stringify } from 'qs';
import { Logger } from 'winston';
import { TokenSymbol } from '../tokens/TokenSymbol';

export class OrdersFilter {
    status?: Status;
    principalTokenSymbol?: TokenSymbol;
    collateralTokenSymbol?: TokenSymbol;
    minUsdAmount?: number;
    maxUsdAmount?: number;
    debtor?: Address;
    creditor?: Address;
}

@Injectable()
export class DharmaOrdersFetcher {
    constructor(
        @Inject('bloqboard-uri') private readonly bloqboardUri: string,
        @Inject('dharma-kernel-address') private readonly dharmaKernelAddress: Address,
        @Inject('winston') private readonly logger: Logger,
        private readonly tokenService: TokenService,
    ) { }
    async fetchOrder(offerId: string): Promise<RelayerDebtOrder> {
        const debtsUrl = `${this.bloqboardUri}/Debts`;
        const response = await Axios.get(`${debtsUrl}/${offerId}`, {
            httpsAgent: new Agent({ rejectUnauthorized: false }),
        });

        return response.data;
    }

    async fetchOrders(filter: OrdersFilter): Promise<RelayerDebtOrder[]> {
        const debtsUrl = `${this.bloqboardUri}/Debts`;
        const kernelAddress = this.dharmaKernelAddress;
        const pagination = {}; // TODO: add sorting & pagination
        const sorting = {};

        const principalToken = filter.principalTokenSymbol && this.tokenService.getTokenBySymbol(filter.principalTokenSymbol);
        const collateralToken = filter.collateralTokenSymbol && this.tokenService.getTokenBySymbol(filter.collateralTokenSymbol);

        const queryStringFilter = {
            principalTokenAddresses: principalToken && [principalToken.address],
            collateralTokenAddresses: collateralToken && [collateralToken.address],
            amountFrom: filter.minUsdAmount,
            amountTo: filter.maxUsdAmount,
            debtorAddress: filter.debtor,
            creditorAddress: filter.creditor,
        };

        const params = {
            status: filter.status, ...pagination, kernelAddress, ...sorting, ...queryStringFilter,
        };

        const str = (parameters: any) => stringify(parameters, { allowDots: true, arrayFormat: 'repeat' });

        const response = await Axios.get(debtsUrl, {
            params,
            paramsSerializer: str,
            httpsAgent: new Agent({ rejectUnauthorized: false }),
        });

        this.logger.info(`Recieved ${response.data.length} debt orders from ${response.config.url}?${str(params)}`);

        return response.data;
    }
}