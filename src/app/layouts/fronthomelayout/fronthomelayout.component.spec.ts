import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { FronthomelayoutComponent } from './fronthomelayout.component';

describe('FronthomelayoutComponent', () => {
  let component: FronthomelayoutComponent;
  let fixture: ComponentFixture<FronthomelayoutComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ FronthomelayoutComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(FronthomelayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
