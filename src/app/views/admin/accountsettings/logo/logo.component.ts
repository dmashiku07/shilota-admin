import { ChangeDetectorRef, Component, OnInit, ElementRef, ViewContainerRef } from '@angular/core';
import { AuthenticationService } from '../../../../service/authentication.service';
import { Router, ActivatedRoute } from '@angular/router';
import { UntypedFormGroup, UntypedFormBuilder, UntypedFormControl, Validators, FormArray, NgForm, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { FileValidator } from '../../../../provider/file-input.validator'
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
@Component({
  standalone: false,
selector: 'app-logo',
  templateUrl: './logo.component.html',
  styleUrls: ['./logo.component.css']
})
export class LogoComponent implements OnInit {
  users: any = {};
  Form: UntypedFormGroup;
  logo: File;
  url: any;
  loading = false;
  isLoading = false;
  constructor(private service: AuthenticationService, private router: Router,
    private fb: UntypedFormBuilder,
    private route: ActivatedRoute,
    private elem: ElementRef,
    public toastr: ToastrService,
    vcr: ViewContainerRef,
    private cdr: ChangeDetectorRef) {  }

  ngOnInit() {
    this.url = environment.apiUrl;
    this.createForm();
    this.loadSettings();
  }

  createForm() {
    this.Form = new UntypedFormGroup({
      logo: new UntypedFormControl("", [FileValidator.validate])
    });
  }
  loadSettings() {
    this.loading = true;
    this.service.getUserinfo().subscribe(
      res => {
        this.users = res || {};
        this.loading = false;
      },
      () => {
        this.loading = false;
      }
    );
  }
  addLogo(Form) {
    if (this.Form.valid) {
        let files = this.elem.nativeElement.querySelector('#logo').files;
        if (!this.validateFile(files[0].name)) {
          this.toastr.error('Support File Format - png,jpeg,jpg ', 'Error!');
          this.cdr.detectChanges();
        } else {
          this.isLoading = true;
          this.cdr.detectChanges();
          let formData = new FormData();
          let file = files[0];
          formData.append('logo', file, file.name);
          this.service.updateLogo(formData).subscribe(
            data => {
              this.isLoading = false;
              this.cdr.detectChanges();
              if (data['success']) {
                this.toastr.success(data['msg']);
                this.loadSettings();
                this.router.navigate(['admin/account/logo/']);
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
        }
    }
    else {
      this.validateAllFormFields(this.Form);
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
  validateFile(name: String) {
    var ext = name.substring(name.lastIndexOf('.') + 1);
    if (ext.toLowerCase() === 'png') {
      return true;
    } else if (ext.toLowerCase() === 'jpeg') {
      return true;
    } else if (ext.toLowerCase() === 'jpg') {
      return true;
    } else {
      return false;
    }
  }
}
