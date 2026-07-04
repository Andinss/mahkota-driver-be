import { Test, TestingModule } from '@nestjs/testing';
import { FieldOfficerService } from './field-officer.service';

describe('FieldOfficerService', () => {
  let service: FieldOfficerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FieldOfficerService],
    }).compile();

    service = module.get<FieldOfficerService>(FieldOfficerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
