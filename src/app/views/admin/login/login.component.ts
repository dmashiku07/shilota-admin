import { Component, OnInit } from "@angular/core";
import { Router, ActivatedRoute } from "@angular/router";
import {
  UntypedFormGroup,
  UntypedFormBuilder,
  UntypedFormControl,
  Validators
} from "@angular/forms";
import { ToastrService } from "ngx-toastr";
import { AuthenticationService } from "app/service/authentication.service";

@Component({
  standalone: false,
selector: "app-login",
  templateUrl: "./login.component.html",
  styleUrls: ["./login.component.scss"]
})
export class LoginComponent implements OnInit {
  username: String;
  password: String;
  form: UntypedFormGroup;
  constructor(
    private authService: AuthenticationService,
    private router: Router,
    private route: ActivatedRoute,
    private fb: UntypedFormBuilder,
    public toastr: ToastrService
  ) {
    if (this.authService.loggedIn()) {
      this.router.navigate(["/dashboard"]);
    }
  }

  ngOnInit() {
    this.form = this.fb.group({
      username: [
        "",
        Validators.compose([Validators.required, Validators.email])
      ],
      password: ["", Validators.required]
    });
  }

  onLoginSubmit(login) {
    if (this.form.valid) {
      const user = {
        username: login.username,
        password: login.password,
        role: "admin"
      };

      this.authService.authenticateUser(user).subscribe((data: {}) => {
        if (data["success"]) {
          if (
            !localStorage.getItem("authtoken") &&
            !localStorage.getItem("user")
          ) {
            this.authService.storeUserData(data["token"], data["user"]);
            this.router.navigate(["/dashboard"]);
          } else {
            this.toastr.error("Kindly sign out as user");
            window.scrollTo(0, 0);
          }
        } else {
          this.toastr.error(data["msg"]);
          this.router.navigate(["/"]);
        }
      });
    } else {
      this.validateAllFormFields(this.form);
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
