import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { RideHistoryComponent } from './ride-history.component';

describe('RideHistoryComponent', () => {
  let component: RideHistoryComponent;
  let fixture: ComponentFixture<RideHistoryComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ RideHistoryComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(RideHistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
