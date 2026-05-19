import { Component, OnInit, ElementRef, ViewContainerRef } from '@angular/core';
import { UntypedFormGroup, UntypedFormBuilder, UntypedFormControl, Validators, FormArray, NgForm, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CategoryService } from '../../../../../service/category.service';
import { Observable } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { FileValidator } from '../../../../../provider/file-input.validator'
import { environment } from '../../../../../../environments/environment';

@Component({
  standalone: false,
selector: 'app-image',
  templateUrl: './image.component.html',
  styleUrls: ['./image.component.css']
})
export class ImageComponent implements OnInit {
  user: any;
  Form: UntypedFormGroup;
  image: File;
  category: any;
  url:any;
  constructor(private service: CategoryService, private router: Router,
    private fb: UntypedFormBuilder,
    private route: ActivatedRoute,
    private elem: ElementRef,
    public toastr: ToastrService, vcr: ViewContainerRef) {  }


  ngOnInit() {
    this.url=environment.apiUrl;
    this.createForm();

    this.route.params.subscribe(params => {
      this.category = this.service.edit(params['id']).subscribe(res => {
        this.category = res;
      });
    });
  }


  createForm() {
    this.Form = new UntypedFormGroup({
      image: new UntypedFormControl("", [FileValidator.validate])
    });
  }

  Image(Form) {
    if (this.Form.valid) {
      this.route.params.subscribe(params => {
        let files = this.elem.nativeElement.querySelector('#image').files;
        if (!this.validateFile(files[0].name)) {
          this.toastr.error('Support File Format - png,jpeg,jpg ');

        } else {
          let formData = new FormData();
          let file = files[0];
          formData.append('image', file, file.name);
          this.service.updateImage(formData, params['id']).subscribe(data => {
            if (data['success']) {
              sessionStorage.setItem("SuccessMessage", data['msg']);
              this.router.navigate(['admin/category/view']);
              window.scrollTo(0, 0);
            }

            if (data['error']) {
              this.toastr.error(data['msg']);
              window.scrollTo(0, 0);
            }
          });
        }

      });
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
    if (ext.toLowerCase() == 'png') {
      return true;
    }
    else if (ext.toLowerCase() == 'jpeg') {
      return true;
    } else if (ext.toLowerCase() == 'jpg') {
      return true;
    } else {
      return false;
    }
  }

}
