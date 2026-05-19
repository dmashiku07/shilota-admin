import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { DeletedUserComponent } from './deleteduser.component';

describe('DeletedUserComponent', () => {
  let component: DeletedUserComponent;
  let fixture: ComponentFixture<DeletedUserComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ DeletedUserComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DeletedUserComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
