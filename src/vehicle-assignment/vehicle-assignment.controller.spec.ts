import { Test, TestingModule } from '@nestjs/testing';
import { VehicleAssignmentController } from './vehicle-assignment.controller';

describe('VehicleAssignmentController', () => {
  let controller: VehicleAssignmentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VehicleAssignmentController],
    }).compile();

    controller = module.get<VehicleAssignmentController>(
      VehicleAssignmentController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
