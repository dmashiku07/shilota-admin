import { ChangeDetectorRef, Component, OnInit, ViewContainerRef } from '@angular/core';
import { AuthenticationService } from '../../../../service/authentication.service';
import { Router, ActivatedRoute } from '@angular/router';
import { UntypedFormGroup, UntypedFormBuilder, UntypedFormControl, Validators, FormArray, NgForm, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
@Component({
  standalone: false,
selector: 'app-password',
  templateUrl: './password.component.html',
  styleUrls: ['./password.component.css']
})
export class PasswordComponent implements OnInit {
  user: any;
  userForm: UntypedFormGroup;
  isLoading = false;
  constructor(private authService: AuthenticationService, private router: Router,
    private fb: UntypedFormBuilder,
    private route: ActivatedRoute,
    public toastr: ToastrService, vcr: ViewContainerRef,
    private cdr: ChangeDetectorRef) { }
  ngOnInit() {
    this.userForm = this.fb.group({
      password: ['', Validators.required],
      newPassword: ['', Validators.compose([Validators.required, Validators.minLength(6)])],
    });
  }
  updatePassword(userForm) {
    if (this.userForm.valid) {
      this.isLoading = true;
      this.cdr.detectChanges();
      this.route.params.subscribe(params => {
        this.authService.ChangePassword(userForm, params['id']).subscribe(
          data => {
            this.isLoading = false;
            this.cdr.detectChanges();
            if (data['success']) {
              this.toastr.success(data['msg'], 'Success!');
            }
            if (data['error']) {
              this.toastr.error(data['msg'], 'Error!');
            }
          },
          error => {
            this.isLoading = false;
            this.cdr.detectChanges();
            this.toastr.error('An error occurred', 'Error!');
          }
        );
      });
    }
    else {
      this.validateAllFormFields(this.userForm);
    }
  }
  validateAllFormFields(formGroup: UntypedFormGroup) {
    Object.keys(formGroup.controls).forEach(field => {
      const control = formGroup.get(field);
      if (control instanceof UntypedFormControl) {
        control.markAsTouched({ onlySelf: true });
      } else if (control instanceof UntypedFormGroup) {
        this.validateAllFormFields(control);
      }
    });
  }
}
