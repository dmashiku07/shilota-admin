import { Component, OnInit, ElementRef, ViewContainerRef } from '@angular/core';
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
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AmenitiesService } from '../../../../../service/amenities.service';
import { Observable } from 'rxjs';
import { FileValidator } from '../../../../../provider/file-input.validator';
import { ToastrService } from 'ngx-toastr';
@Component({
  standalone: false,
selector: 'app-add',
  templateUrl: './add.component.html',
  styleUrls: ['./add.component.css']
})
export class AddComponent implements OnInit {
  Form: UntypedFormGroup;
  image: File;
  constructor(
    private service: AmenitiesService,
    private fb: UntypedFormBuilder,
    private elem: ElementRef,
    private router: Router,
    public toastr: ToastrService,
    vcr: ViewContainerRef
  ) {}
  ngOnInit() {
    this.createForm();
  }
  createForm() {
    this.Form = this.fb.group({
      name: [
        '',
        Validators.compose([
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(30)
        ])
      ],
      image: ['', FileValidator.validate]
    });
  }

  add(form) {
    if (this.Form.valid) {
      let files = this.elem.nativeElement.querySelector('#image').files;
      if (!this.validateFile(files[0].name)) {
        this.toastr.error('Support File Format - png,jpeg,jpg ');
      } else {
        let formData = new FormData();
        let file = files[0];
        formData.append('name', form.name);
        formData.append('image', file, form.image);
        this.service.add(formData).subscribe(data => {
          if (data['success']) {
            this.toastr.success(data['msg']);
            this.router.navigate(['admin/amenities/view']);
            window.scrollTo(0, 0);
          }
          if (data['error']) {
            this.toastr.error(data['msg']);
            window.scrollTo(0, 0);
          }
        });
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
    let ext = name.substring(name.lastIndexOf('.') + 1);
    if (ext.toLowerCase() == 'png') {
      return true;
    } else if (ext.toLowerCase() == 'jpeg') {
      return true;
    } else if (ext.toLowerCase() == 'jpg') {
      return true;
    } else {
      return false;
    }
  }
}
