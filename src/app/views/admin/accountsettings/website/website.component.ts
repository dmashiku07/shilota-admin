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
import { finalize } from "rxjs/operators";
import { forkJoin } from "rxjs";
@Component({
  standalone: false,
selector: "app-website",
  templateUrl: "./website.component.html",
  styleUrls: ["./website.component.css"]
})
export class WebsiteComponent implements OnInit {
  user: any = {};
  userForm: UntypedFormGroup;
  loading = false;
  isLoading = false;
  saveStatus = "";
  minutes: any;
  distance: any;
  maxdistance: any;
  constructor(
    private authService: AuthenticationService,
    private router: Router,
    private fb: UntypedFormBuilder,
    private route: ActivatedRoute,
    public toastr: ToastrService,
    vcr: ViewContainerRef,
    private cdr: ChangeDetectorRef
  ) {}
  ngOnInit() {
    this.createForm();
    this.loadSettings();
  }
  createForm() {
    this.userForm = this.fb.group({
      _id: [""],
      username: ["", Validators.compose([Validators.required, Validators.email])],
      email: ["", Validators.compose([Validators.required, Validators.email])],
      footer: ["", Validators.required],
      apptitle: ["", Validators.compose([Validators.required, Validators.minLength(3)])],
      appcontent: ["", Validators.compose([Validators.required, Validators.minLength(3)])],
      phone: ["", Validators.compose([Validators.required])],
      distancePerCab: ["", Validators.compose([Validators.required])],
      tax: ["", Validators.compose([Validators.required])],
      inspectionon: ["", Validators.compose([Validators.required])],
      maxDistance: ["", Validators.compose([Validators.required])],
      currencyCode: ["", Validators.required],
      currencySymbol: ["", Validators.required],
      siteName: ["", Validators.required],
      emergencyContact: ["", Validators.required],
      googleMapKey: ["", Validators.required],
      helppagesheader: ["", Validators.required],
      maxdisperride: ["", Validators.required]
    });
  }

  loadSettings() {
    this.loading = true;
    this.saveStatus = "";
    this.authService.getProfile().subscribe(
      res => {
        this.user = res || {};
        this.userForm.patchValue({
          _id: this.user._id || "",
          username: this.user.username || "",
          email: this.user.email || "",
          footer: this.user.footer || "",
          apptitle: this.user.apptitle || "",
          appcontent: this.user.appcontent || "",
          phone: this.user.phone || "",
          distancePerCab: this.user.distancePerCab || "",
          tax: this.user.tax || "",
          inspectionon: this.user.inspectionon || "",
          maxDistance: this.user.maxDistance || "",
          currencyCode: this.user.currencyCode || "",
          currencySymbol: this.user.currencySymbol || "",
          siteName: this.user.siteName || "",
          emergencyContact: this.user.emergencyContact || "",
          googleMapKey: this.user.googleMapKey || "",
          helppagesheader: this.user.helppagesheader || "",
          maxdisperride: this.user.maxdisperride || ""
        });
        this.userForm.markAsPristine();
        this.loading = false;
      },
      () => {
        this.loading = false;
      }
    );
  }
  updateSetting(user) {
    if (this.userForm.valid) {
      const id = user._id;
      if (!id) {
        this.toastr.error("Missing settings record", "Error!");
        return;
      }

      this.isLoading = true;
      this.saveStatus = "saving";
      this.cdr.detectChanges();
      this.authService.updateSetting(user, id)
        .pipe(finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        }))
        .subscribe(
          data => {
            this.user = {
              ...this.user,
              ...user,
              currencySymbol: user.currencySymbol,
              currencyCode: user.currencyCode
            };
            this.userForm.patchValue({
              ...user,
              _id: id
            });
            this.userForm.markAsPristine();
            this.saveStatus = "saved";
            forkJoin([
              this.authService.refreshProfile(),
              this.authService.refreshUserinfo()
            ]).subscribe({
              error: () => {}
            });
            this.toastr.success(data["msg"] || "Website settings updated successfully", "", { timeOut: 3000 });
          },
          () => {
            this.saveStatus = "error";
            this.toastr.error("An error occurred", "Error!");
          }
        );
    } else {
      this.saveStatus = "";
      this.validateAllFormFields(this.userForm);
    }
  }

  numberOnly(event): boolean {
    const charCode = event.which ? event.which : event.keyCode;
    if (charCode > 31 && (charCode < 48 || charCode > 57)) {
      return false;
    }
    return true;
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
