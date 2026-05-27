import { Controller, Post, Get, Body, Req, Put, Delete } from '@nestjs/common';
import { AddDriverDto } from './dto/add-driver.dto';
import { DriverService } from './driver.service';
import { UpdateDriverDto } from './dto/update-driver.dto';

@Controller('driver')
export class DriverController {
  constructor(private readonly driverService: DriverService) {}
  @Get()
  findAll() {
    return this.driverService.findAll();
  }

  @Post('create')
  create(@Body() addDriverDto: AddDriverDto) {
    return this.driverService.create(addDriverDto);
  }

  @Put('update/:id')
  update(@Body() updateDriverDto: Partial<UpdateDriverDto>, @Req() req: any) {
    const driverId = req.params.id;
    return this.driverService.update(driverId, updateDriverDto);
  }
  @Delete('delete/:id')
  delete(@Req() req: any) {
    const driverId = req.params.id;
    return this.driverService.delete(driverId);
  }
}
