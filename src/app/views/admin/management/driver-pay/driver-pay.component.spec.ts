import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { DriverPayComponent } from './driver-pay.component';

describe('DriverPayComponent', () => {
  let component: DriverPayComponent;
  let fixture: ComponentFixture<DriverPayComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ DriverPayComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DriverPayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
