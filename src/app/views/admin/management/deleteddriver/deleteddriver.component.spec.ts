import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { DeletedDriverComponent } from './deleteddriver.component';

describe('DeletedDriverComponent', () => {
  let component: DeletedDriverComponent;
  let fixture: ComponentFixture<DeletedDriverComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ DeletedDriverComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DeletedDriverComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
