import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { ReviewRideComponent } from './review-ride.component';

describe('ReviewRideComponent', () => {
  let component: ReviewRideComponent;
  let fixture: ComponentFixture<ReviewRideComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ ReviewRideComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ReviewRideComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
