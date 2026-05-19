import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { WalletPayHistoryComponent } from './wallet-pay-history.component';

describe('WalletPayHistoryComponent', () => {
  let component: WalletPayHistoryComponent;
  let fixture: ComponentFixture<WalletPayHistoryComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ WalletPayHistoryComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WalletPayHistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
