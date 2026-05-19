import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { WalletPaymentFailureComponent } from './wallet-payment-failure.component';

describe('WalletPaymentFailureComponent', () => {
  let component: WalletPaymentFailureComponent;
  let fixture: ComponentFixture<WalletPaymentFailureComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ WalletPaymentFailureComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WalletPaymentFailureComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
