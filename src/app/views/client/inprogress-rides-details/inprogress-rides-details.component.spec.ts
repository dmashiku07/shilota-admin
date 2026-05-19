import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { InprogressRidesDetailsComponent } from './inprogress-rides-details.component';

describe('InprogressRidesDetailsComponent', () => {
  let component: InprogressRidesDetailsComponent;
  let fixture: ComponentFixture<InprogressRidesDetailsComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ InprogressRidesDetailsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(InprogressRidesDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
