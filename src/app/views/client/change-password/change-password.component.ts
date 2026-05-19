import { Component, OnInit } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { TranslateModule } from '@ngx-translate/core';
import {
  UntypedFormGroup,
  UntypedFormBuilder,
  UntypedFormControl,
  Validators
} from '@angular/forms';
import { WebappService } from '../../../service/webapp.service';
import { AuthenticationService } from 'app/service/authentication.service';

@Component({
  standalone: false,
selector: 'app-change-password',
  templateUrl: './change-password.component.html',
  styleUrls: ['./change-password.component.scss']
})
export class ChangePasswordComponent implements OnInit {
  profilelog: any;
  profileid: any;
  profileinfo: any;
  requestData: any;
  passwordForm: UntypedFormGroup;
  showPass: boolean;
  showconfirmPass: boolean;
  constructor(
    private apiservice: WebappService,
    private authService: AuthenticationService,
    private router: Router,
    public toastr: ToastrService,
    private translate: TranslateService,
    private fb: UntypedFormBuilder
  ) {
    this.showPass = false;
    this.showconfirmPass = false;
    this.passwordForm = this.fb.group(
      {
        old_pass: [
          '',
          Validators.compose([Validators.required, Validators.minLength(6)])
        ],
        new_pass: [
          '',
          Validators.compose([Validators.required, Validators.minLength(6)])
        ],
        confirm_pass: [
          '',
          Validators.compose([Validators.required, Validators.minLength(6)])
        ]
      },
      { validator: [this.checknewPasswords, this.checkoldPasswords ]}
    );
  }

  ngOnInit() {}

  onProfileSubmit(formdata) {
    if (this.passwordForm.valid) {
      this.profilelog = JSON.parse(localStorage.getItem('user'));
      this.profileid = this.profilelog.id;
      const requestData = {
        user_id: this.profileid,
        old_password: formdata.old_pass,
        new_password: formdata.new_pass
      };
      this.apiservice.changepassword(requestData).subscribe(data => {
        if (data['status'] === 'true') {
          this.router.navigate(['/profile']);
          this.toastr.success(this.translate.instant(data['message']));
          window.scrollTo(0, 0);
        } else {
          this.toastr.error(this.translate.instant(data['message']));
          window.scrollTo(0, 0);
        }
      });
    } else {
      this.validateAllFormFields(this.passwordForm);
    }
  }

  checknewPasswords(group: UntypedFormGroup) {
    let pwd = group.controls.new_pass.value;
    let cpwd = group.controls.confirm_pass.value;
    return pwd === cpwd ? null : { mismatchedPasswords: true };
  }

  checkoldPasswords(group: UntypedFormGroup) {
    let pwd = group.controls.old_pass.value;
    let cpwd = group.controls.new_pass.value;
    return pwd !== cpwd ? null : { oldPasswords: true };
  }

  showPassword(this) {
    this.showPass = !this.showPass;
  }

  showconfirmPassword(this) {
    this.showconfirmPass = !this.showconfirmPass;
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
