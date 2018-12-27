import { Agent } from 'https';
import { Inject, Injectable, HttpException } from '@nestjs/common';
import { RelayerDebtOrder, Status } from './models/RelayerDebtOrder';
import Axios, { AxiosError } from 'axios';
import { Address } from 'src/types';
import { TokenService } from '../tokens/TokenService';
import { stringify } from 'qs';
import { Logger } from 'winston';
import { TokenSymbol } from '../tokens/TokenSymbol';
import { Pagination } from 'src/common-models/Pagination';

export class OrdersFilter {
    status?: Status;
    kind?: 'LendOffer' | 'DebtRequest';
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
        const url = `${this.bloqboardUri}/Debts/${offerId}`;
        try {
            const response = await Axios.get(url, {
                httpsAgent: new Agent({ rejectUnauthorized: false }),
            });

            return response.data;
        } catch (e) {
            const error = e as AxiosError;
            this.logger.error(`${error.message}: ${url}`);
            throw new HttpException(error.response.data, error.response.status);
        }
    }

    async fetchOrders(filter: OrdersFilter, pagination: Pagination): Promise<RelayerDebtOrder[]> {
        const debtsUrl = `${this.bloqboardUri}/Debts`;
        const kernelAddress = this.dharmaKernelAddress;
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

        try {
            const response = await Axios.get(debtsUrl, {
                params,
                paramsSerializer: str,
                httpsAgent: new Agent({ rejectUnauthorized: false }),
            });

            this.logger.info(`Recieved ${response.data.length} debt orders from ${response.config.url}?${str(params)}`);

            return response.data;

        } catch (e) {
            const error = e as AxiosError;
            this.logger.error(`${error.message}: ${error.response.config.url}?${str(params)}`);
            throw new HttpException(error.response.data || 'Request to Bloqboard Relayer API failed', error.response.status);
        }
    }
}