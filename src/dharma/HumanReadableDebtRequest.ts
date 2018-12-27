import { ApiModelProperty } from '@nestjs/swagger';

export class HumanReadableDebtRequest {
    @ApiModelProperty()
    id: string;

    @ApiModelProperty()
    principal: string;

    @ApiModelProperty()
    collateral: string;

    @ApiModelProperty()
    interestRate: number;

    @ApiModelProperty()
    termLength: number;

    @ApiModelProperty()
    amortizationUnit: string;
}
