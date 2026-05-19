import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { HelpDriverComponent } from './help-driver.component';

describe('HelpDriverComponent', () => {
  let component: HelpDriverComponent;
  let fixture: ComponentFixture<HelpDriverComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ HelpDriverComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(HelpDriverComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
