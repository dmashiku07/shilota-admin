import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { MobileappComponent } from './mobileapp.component';

describe('MobileappComponent', () => {
  let component: MobileappComponent;
  let fixture: ComponentFixture<MobileappComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ MobileappComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MobileappComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
