import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { PaymentRidehistoryComponent } from './payment-ridehistory.component';

describe('PaymentRidehistoryComponent', () => {
  let component: PaymentRidehistoryComponent;
  let fixture: ComponentFixture<PaymentRidehistoryComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ PaymentRidehistoryComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PaymentRidehistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
