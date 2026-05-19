import { TestBed, inject } from '@angular/core/testing';

import { AmenitiesService } from './amenities.service';

describe('AmenitiesService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AmenitiesService]
    });
  });

  it('should be created', inject([AmenitiesService], (service: AmenitiesService) => {
    expect(service).toBeTruthy();
  }));
});
