import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { InnerheaderComponent } from './innerheader.component';

describe('InnerheaderComponent', () => {
  let component: InnerheaderComponent;
  let fixture: ComponentFixture<InnerheaderComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ InnerheaderComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(InnerheaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
