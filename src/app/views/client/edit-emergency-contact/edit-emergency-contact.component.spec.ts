import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { EditEmergencyContactComponent } from './edit-emergency-contact.component';

describe('EditEmergencyContactComponent', () => {
  let component: EditEmergencyContactComponent;
  let fixture: ComponentFixture<EditEmergencyContactComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ EditEmergencyContactComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(EditEmergencyContactComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
