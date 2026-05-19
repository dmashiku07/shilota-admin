import { TestBed, inject } from '@angular/core/testing';

import { CommissionsService } from './commissions.service';

describe('CommissionsService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CommissionsService]
    });
  });

  it('should be created', inject([CommissionsService], (service: CommissionsService) => {
    expect(service).toBeTruthy();
  }));
});
