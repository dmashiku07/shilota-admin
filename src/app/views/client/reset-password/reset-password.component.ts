import { Component, OnInit } from "@angular/core";
import { ToastrService } from "ngx-toastr";
import { Router } from "@angular/router";
import { TranslateService } from '@ngx-translate/core';
import { TranslateModule } from '@ngx-translate/core';
import {
  UntypedFormGroup,
  UntypedFormBuilder,
  UntypedFormControl,
  Validators
} from "@angular/forms";
import { WebappService } from "../../../service/webapp.service";
@Component({
  standalone: false,
selector: "app-reset-password",
  templateUrl: "./reset-password.component.html",
  styleUrls: ["./reset-password.component.scss"]
})
export class ResetPasswordComponent implements OnInit {
  profilelog: any;
  profileid: any;
  profileinfo: any;
  requestData: any;
  passwordForm: UntypedFormGroup;
  resetMail: Boolean;
  constructor(
    private apiservice: WebappService,
    public toastr: ToastrService,
    private translate: TranslateService,
    private fb: UntypedFormBuilder,
    private router: Router
  ) {
    this.resetMail = false;
    this.passwordForm = this.fb.group({
      email_id: [
        "",
        Validators.compose([Validators.required, Validators.email])
      ]
    });
  }

  ngOnInit() {}

  onProfileSubmit(formdata) {
    if (this.passwordForm.valid) {
      const requestData = {
        email: formdata.email_id
      };
      this.resetMail = true;
      this.apiservice.forgotpassword(requestData).subscribe(data => {
        if (data["status"] === "true") {
          this.resetMail = false;
          this.toastr.success(this.translate.instant(data["message"]));
          this.router.navigate(["/signin"]);
        } else {
          this.resetMail = false;
          this.toastr.error(this.translate.instant(data["message"]));
          window.scrollTo(0, 0);
        }
      });
    } else {
      this.validateAllFormFields(this.passwordForm);
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
