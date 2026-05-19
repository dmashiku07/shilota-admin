import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { WalletPaymentSuccessComponent } from './wallet-payment-success.component';

describe('WalletPaymentSuccessComponent', () => {
  let component: WalletPaymentSuccessComponent;
  let fixture: ComponentFixture<WalletPaymentSuccessComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ WalletPaymentSuccessComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WalletPaymentSuccessComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
