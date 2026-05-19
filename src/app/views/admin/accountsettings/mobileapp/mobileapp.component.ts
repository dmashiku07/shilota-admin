import { ChangeDetectorRef, Component, OnInit, ViewContainerRef } from '@angular/core';
import { AuthenticationService } from '../../../../service/authentication.service';
import { Router, ActivatedRoute } from '@angular/router';
import { UntypedFormGroup, UntypedFormBuilder, UntypedFormControl, Validators, FormArray, NgForm, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
@Component({
  standalone: false,
selector: 'app-mobileapp',
  templateUrl: './mobileapp.component.html',
  styleUrls: ['./mobileapp.component.css']
})
export class MobileappComponent implements OnInit {
  user: any = {};
  userForm: UntypedFormGroup;
  loading = false;
  isLoading = false;
  constructor(private authService: AuthenticationService, private router: Router,
    private fb: UntypedFormBuilder,
    private route: ActivatedRoute,
    public toastr: ToastrService,
    vcr: ViewContainerRef,
    private cdr: ChangeDetectorRef) { }
  ngOnInit() {
    this.createForm();
    this.loadSettings();
  }
  createForm() {
    this.userForm = this.fb.group({
      _id: [""],
      iosUser: ["", Validators.required],
      iosDriver: ["", Validators.required],
      androidUser: ["", Validators.required],
      androidDriver: ["", Validators.required],
    });
  }
  loadSettings() {
    this.loading = true;
    this.authService.getProfile().subscribe(
      profile => {
        this.user = profile || {};
        this.userForm.patchValue({
          _id: this.user._id || "",
          iosUser: this.user.iosUser || "",
          iosDriver: this.user.iosDriver || "",
          androidUser: this.user.androidUser || "",
          androidDriver: this.user.androidDriver || ""
        });
        this.loading = false;
      },
      () => {
        this.loading = false;
      }
    );
  }
  updateApp(user) {
    if (this.userForm.valid) {
      this.isLoading = true;
      this.cdr.detectChanges();
      this.route.params.subscribe(params => {
        var id = user._id;
        this.authService.updateApp(user, id).subscribe(
          data => {
            this.isLoading = false;
            this.cdr.detectChanges();
            let result = data;
            if (data['success']) {
              this.toastr.success(data['msg']);
              window.scrollTo(0, 0);
            }
            if (data['error']) {
              this.toastr.error(data['msg']);
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
