import { ApiModelProperty } from '@nestjs/swagger';

export class Balance {
    @ApiModelProperty()
    amount: number;

    @ApiModelProperty()
    token: string;
}