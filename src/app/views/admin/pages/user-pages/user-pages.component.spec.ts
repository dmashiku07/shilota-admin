import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { UserPagesComponent } from './user-pages.component';

describe('UserPagesComponent', () => {
  let component: UserPagesComponent;
  let fixture: ComponentFixture<UserPagesComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ UserPagesComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(UserPagesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
