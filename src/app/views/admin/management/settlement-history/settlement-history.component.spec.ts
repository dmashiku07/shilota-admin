import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { SettlementHistoryComponent } from './settlement-history.component';

describe('SettlementHistoryComponent', () => {
  let component: SettlementHistoryComponent;
  let fixture: ComponentFixture<SettlementHistoryComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ SettlementHistoryComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SettlementHistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
