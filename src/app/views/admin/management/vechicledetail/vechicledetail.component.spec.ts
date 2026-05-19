import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { VechicledetailComponent } from './vechicledetail.component';

describe('VechicledetailComponent', () => {
  let component: VechicledetailComponent;
  let fixture: ComponentFixture<VechicledetailComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ VechicledetailComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(VechicledetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
