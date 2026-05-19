import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { RidePaymentComponent } from './ride-payment.component';

describe('RidePaymentComponent', () => {
  let component: RidePaymentComponent;
  let fixture: ComponentFixture<RidePaymentComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ RidePaymentComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(RidePaymentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
