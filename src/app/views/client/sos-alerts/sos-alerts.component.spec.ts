import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { SosAlertsComponent } from './sos-alerts.component';

describe('SosAlertsComponent', () => {
  let component: SosAlertsComponent;
  let fixture: ComponentFixture<SosAlertsComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ SosAlertsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SosAlertsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
