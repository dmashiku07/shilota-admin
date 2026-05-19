import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { UserinnerlayoutComponent } from './userinnerlayout.component';

describe('UserinnerlayoutComponent', () => {
  let component: UserinnerlayoutComponent;
  let fixture: ComponentFixture<UserinnerlayoutComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ UserinnerlayoutComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(UserinnerlayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
