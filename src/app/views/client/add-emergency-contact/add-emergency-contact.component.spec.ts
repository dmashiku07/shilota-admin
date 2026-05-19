import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { AddEmergencyContactComponent } from './add-emergency-contact.component';

describe('AddEmergencyContactComponent', () => {
  let component: AddEmergencyContactComponent;
  let fixture: ComponentFixture<AddEmergencyContactComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ AddEmergencyContactComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AddEmergencyContactComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
