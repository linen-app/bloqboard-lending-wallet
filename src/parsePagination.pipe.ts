import { Injectable, PipeTransform, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { Pagination } from './common-models/Pagination';

@Injectable()
export class ParsePaginationPipe implements PipeTransform<any> {
    async transform(value: any, metadata: ArgumentMetadata): Promise<Pagination> {

        const pagination: Pagination = {
            limit: value.limit,
            offset: value.offset,
        };

        return pagination;
    }
}