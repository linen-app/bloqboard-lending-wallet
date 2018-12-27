import { ApiModelProperty } from '@nestjs/swagger';

export class Pagination {
    @ApiModelProperty({
        description: 'Optional pagination parameter: index offset from the first element in the response. Synonym to "page size".',
        default: '0',
        required: false,
    })
    offset: number = 0;

    @ApiModelProperty({
        description: 'Optional pagination parameter: max number of items in the respose. Maximum value: 100',
        default: 30,
        maximum: 100,
        required: false,
    })
    limit: number = 30;

    static get default() {
        return {
            offset: 0,
            limit: 30,
        };
    }
}