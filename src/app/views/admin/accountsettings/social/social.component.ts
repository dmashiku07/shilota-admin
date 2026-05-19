import { ChangeDetectorRef, Component, OnInit, ViewContainerRef } from '@angular/core';
import { AuthenticationService } from '../../../../service/authentication.service';
import { Router, ActivatedRoute } from '@angular/router';
import { UntypedFormGroup, UntypedFormBuilder, Validators, FormArray, NgForm, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
@Component({
  standalone: false,
selector: 'app-social',
  templateUrl: './social.component.html',
  styleUrls: ['./social.component.css']
})
export class SocialComponent implements OnInit {
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
      facebook: ["", Validators.required],
      twitter: ["", Validators.required],
      instagram: ["", Validators.required],
      linkedin: ["", Validators.required],
      googleplus: ["", Validators.required],
    });
  }
  loadSettings() {
    this.loading = true;
    this.authService.getProfile().subscribe(
      profile => {
        this.user = profile || {};
        this.userForm.patchValue({
          _id: this.user._id || "",
          facebook: this.user.facebook || "",
          twitter: this.user.twitter || "",
          instagram: this.user.instagram || "",
          linkedin: this.user.linkedin || "",
          googleplus: this.user.googleplus || ""
        });
        this.loading = false;
      },
      () => {
        this.loading = false;
      }
    );
  }
  updateUser(user) {
    this.isLoading = true;
    this.cdr.detectChanges();
    this.route.params.subscribe(params => {
      let id = user._id;
      this.authService.updateEmail(user, id).subscribe(
        data => {
          this.isLoading = false;
          this.cdr.detectChanges();
          this.toastr.success(data['msg']);
          window.scrollTo(0, 0);
        },
        error => {
          this.isLoading = false;
          this.cdr.detectChanges();
          this.toastr.error('An error occurred', 'Error!');
        }
      );
    });
  }
}
