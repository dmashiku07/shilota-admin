import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { RidesDetailsComponent } from './rides-details.component';

describe('RidesDetailsComponent', () => {
  let component: RidesDetailsComponent;
  let fixture: ComponentFixture<RidesDetailsComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ RidesDetailsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(RidesDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
