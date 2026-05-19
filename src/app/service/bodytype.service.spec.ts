import { TestBed, inject } from '@angular/core/testing';

import { BodytypeService } from './bodytype.service';

describe('BodytypeService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [BodytypeService]
    });
  });

  it('should be created', inject([BodytypeService], (service: BodytypeService) => {
    expect(service).toBeTruthy();
  }));
});
