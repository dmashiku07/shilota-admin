import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { FrontinnerlayoutComponent } from './frontinnerlayout.component';

describe('FrontinnerlayoutComponent', () => {
  let component: FrontinnerlayoutComponent;
  let fixture: ComponentFixture<FrontinnerlayoutComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ FrontinnerlayoutComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(FrontinnerlayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
