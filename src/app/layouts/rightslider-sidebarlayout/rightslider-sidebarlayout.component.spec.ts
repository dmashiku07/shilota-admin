import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { RightsliderSidebarlayoutComponent } from './rightslider-sidebarlayout.component';

describe('RightsliderSidebarlayoutComponent', () => {
  let component: RightsliderSidebarlayoutComponent;
  let fixture: ComponentFixture<RightsliderSidebarlayoutComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ RightsliderSidebarlayoutComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(RightsliderSidebarlayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
