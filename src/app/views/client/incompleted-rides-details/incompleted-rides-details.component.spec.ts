import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { IncompletedRidesDetailsComponent } from './incompleted-rides-details.component';

describe('IncompletedRidesDetailsComponent', () => {
  let component: IncompletedRidesDetailsComponent;
  let fixture: ComponentFixture<IncompletedRidesDetailsComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ IncompletedRidesDetailsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(IncompletedRidesDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
