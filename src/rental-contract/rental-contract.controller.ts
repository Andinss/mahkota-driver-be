import {
  Body,
  Controller,
  Post,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { PreviewContractDto } from './dto/preview-contract.dto';
import { RentalContractService } from './rental-contract.service';

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('rental-contract')
export class RentalContractController {
  constructor(private readonly rentalContractService: RentalContractService) {}

  // Preview kontrak sewa sesuai driver & kendaraan yang dipilih di form rental.
  @Post('preview')
  @Permissions('rental.read')
  async preview(@Body() dto: PreviewContractDto): Promise<StreamableFile> {
    const result = await this.rentalContractService.generatePreview(dto);

    return new StreamableFile(result.buffer, {
      type: DOCX_MIME,
      disposition: `inline; filename="${result.filename}"`,
    });
  }
}
