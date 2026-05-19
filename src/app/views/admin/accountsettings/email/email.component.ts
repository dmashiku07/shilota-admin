import { ChangeDetectorRef, Component, OnInit, ViewContainerRef } from "@angular/core";
import { AuthenticationService } from "../../../../service/authentication.service";
import { Router, ActivatedRoute } from "@angular/router";
import {
  UntypedFormGroup,
  UntypedFormBuilder,
  UntypedFormControl,
  Validators
} from "@angular/forms";
import { ToastrService } from "ngx-toastr";
@Component({
  standalone: false,
selector: "app-email",
  templateUrl: "./email.component.html",
  styleUrls: ["./email.component.css"]
})
export class EmailComponent implements OnInit {
  user: any = {};
  result: any;
  userForm: UntypedFormGroup;
  loading = false;
  isLoading = false;
  constructor(
    private authService: AuthenticationService,
    private fb: UntypedFormBuilder,
    private route: ActivatedRoute,
    public toastr: ToastrService,
    vcr: ViewContainerRef,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}
  ngOnInit() {
    this.createForm();
    this.loadSettings();
  }
  createForm() {
    this.userForm = this.fb.group({
      _id: [""],
      smptHost: ["", Validators.required],
      smtpPort: ["", Validators.required],
      smtpUsername: ["", Validators.required],
      smtpPassword: ["", Validators.required]
    });
  }

  loadSettings() {
    this.loading = true;
    this.authService.getProfile().subscribe(
      res => {
        this.user = res || {};
        this.userForm.patchValue({
          _id: this.user._id || "",
          smptHost: this.user.smptHost || "",
          smtpPort: this.user.smtpPort || "",
          smtpUsername: this.user.smtpUsername || "",
          smtpPassword: this.user.smtpPassword || ""
        });
        this.loading = false;
      },
      () => {
        this.loading = false;
      }
    );
  }

  updateSmtp(user) {
    if (this.userForm.valid) {
      this.isLoading = true;
      this.cdr.detectChanges();
      this.route.params.subscribe(params => {
        let id = user._id;
        this.authService.updateSMTP(user, id).subscribe(
          (data: {}) => {
            this.isLoading = false;
            this.cdr.detectChanges();
            this.result = data;
            if (data["success"]) {
              this.toastr.success(this.result.msg, "");
              window.scrollTo(0, 0);
            } else {
              this.toastr.error(this.result.msg, "");
            }
          },
          error => {
            this.isLoading = false;
            this.cdr.detectChanges();
            this.toastr.error('An error occurred', 'Error!');
          }
        );
      });
    } else {
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
