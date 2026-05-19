import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { PaymentdetailsComponent } from './paymentdetails.component';

describe('PaymentdetailsComponent', () => {
  let component: PaymentdetailsComponent;
  let fixture: ComponentFixture<PaymentdetailsComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ PaymentdetailsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PaymentdetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
