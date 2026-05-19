import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { FrontsidebarComponent } from './frontsidebar.component';

describe('FrontsidebarComponent', () => {
  let component: FrontsidebarComponent;
  let fixture: ComponentFixture<FrontsidebarComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ FrontsidebarComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(FrontsidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
