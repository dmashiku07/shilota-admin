import { ChangeDetectorRef, Component, OnInit, ElementRef, ViewContainerRef } from '@angular/core';
import { AuthenticationService } from '../../../../service/authentication.service';
import { Router, ActivatedRoute } from '@angular/router';
import {
  UntypedFormGroup,
  UntypedFormBuilder,
  UntypedFormControl,
  Validators,
  FormArray,
  NgForm,
  FormsModule,
  ReactiveFormsModule
} from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { FileValidator } from '../../../../provider/file-input.validator';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';

@Component({
  standalone: false,
selector: 'app-favicon',
  templateUrl: './favicon.component.html',
  styleUrls: ['./favicon.component.css']
})
export class FaviconComponent implements OnInit {
  user: any = {};
  Form: UntypedFormGroup;
  favIcon: File;
  url: any;
  loading = false;
  isLoading = false;
  constructor(
    private service: AuthenticationService,
    private router: Router,
    private fb: UntypedFormBuilder,
    private route: ActivatedRoute,
    private elem: ElementRef,
    public toastr: ToastrService,
    vcr: ViewContainerRef,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.url = environment.apiUrl;
    this.createForm();
    this.loadSettings();
  }

  createForm() {
    this.Form = new UntypedFormGroup({
      favIcon: new UntypedFormControl('', [FileValidator.validate])
    });
  }
  loadSettings() {
    this.loading = true;
    this.service.getUserinfo().subscribe(
      res => {
        this.user = res || {};
        this.loading = false;
      },
      () => {
        this.loading = false;
      }
    );
  }

  addFavi(Form) {
    if (this.Form.valid) {
      let files = this.elem.nativeElement.querySelector('#favIcon').files;
      if (!this.validateFile(files[0].name)) {
        this.toastr.error('Support .png files only');
        this.cdr.detectChanges();
      } else {
        this.isLoading = true;
        this.cdr.detectChanges();
        let formData = new FormData();
        let file = files[0];
        formData.append('favIcon', file, file.name);
        this.service.updateFavicon(formData).subscribe(
          (data: {}) => {
            this.isLoading = false;
            this.cdr.detectChanges();
            if (data['success']) {
              this.toastr.success(data['msg']);
              this.loadSettings();
              this.router.navigate(['admin/account/favicon/']);
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
    } else {
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
    const ext = name.substring(name.lastIndexOf('.') + 1);
    if (ext.toLowerCase() === 'png') {
      return true;
    } else {
      return false;
    }
  }
}
