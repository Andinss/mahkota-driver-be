import { Test, TestingModule } from '@nestjs/testing';
import { FieldOfficerController } from './field-officer.controller';

describe('FieldOfficerController', () => {
  let controller: FieldOfficerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FieldOfficerController],
    }).compile();

    controller = module.get<FieldOfficerController>(FieldOfficerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
