import { Test, TestingModule } from '@nestjs/testing';
import { VehicleAssignmentService } from './vehicle-assignment.service';

describe('VehicleAssignmentService', () => {
  let service: VehicleAssignmentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VehicleAssignmentService],
    }).compile();

    service = module.get<VehicleAssignmentService>(VehicleAssignmentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
