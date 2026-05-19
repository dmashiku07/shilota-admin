import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { EmergencyContactsComponent } from './emergency-contacts.component';

describe('EmergencyContactsComponent', () => {
  let component: EmergencyContactsComponent;
  let fixture: ComponentFixture<EmergencyContactsComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ EmergencyContactsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(EmergencyContactsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
