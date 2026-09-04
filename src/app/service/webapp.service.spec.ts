import { TestBed } from '@angular/core/testing';

import { WebappService } from './webapp.service';

describe('WebappService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: WebappService = TestBed.inject(WebappService);
    expect(service).toBeTruthy();
  });
});
