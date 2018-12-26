import { ApiModelProperty } from '@nestjs/swagger';

export class HumanReadableLendOffer {
    @ApiModelProperty()
    id: string;

    @ApiModelProperty()
    principal: string;

    @ApiModelProperty()
    maxLtv: number;

    @ApiModelProperty()
    interestRate: number;

    @ApiModelProperty()
    termLength: number;

    @ApiModelProperty()
    amortizationUnit: string;

    @ApiModelProperty()
    collateralTokenSymbol: string;
}
