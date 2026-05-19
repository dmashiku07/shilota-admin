import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { CompletedRidesDetailsComponent } from './completed-rides-details.component';

describe('CompletedRidesDetailsComponent', () => {
  let component: CompletedRidesDetailsComponent;
  let fixture: ComponentFixture<CompletedRidesDetailsComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ CompletedRidesDetailsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CompletedRidesDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
