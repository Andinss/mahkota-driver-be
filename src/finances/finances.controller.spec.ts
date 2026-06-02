import { Test, TestingModule } from '@nestjs/testing';
import { FinancesController } from './finances.controller';

describe('FinancesController', () => {
  let controller: FinancesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FinancesController],
    }).compile();

    controller = module.get<FinancesController>(FinancesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
