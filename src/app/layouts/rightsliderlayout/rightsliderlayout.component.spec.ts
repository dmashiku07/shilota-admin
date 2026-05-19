import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { RightsliderlayoutComponent } from './rightsliderlayout.component';

describe('RightsliderlayoutComponent', () => {
  let component: RightsliderlayoutComponent;
  let fixture: ComponentFixture<RightsliderlayoutComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ RightsliderlayoutComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(RightsliderlayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
