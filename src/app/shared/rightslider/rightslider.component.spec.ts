import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { RightsliderComponent } from './rightslider.component';

describe('RightsliderComponent', () => {
  let component: RightsliderComponent;
  let fixture: ComponentFixture<RightsliderComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ RightsliderComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(RightsliderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
