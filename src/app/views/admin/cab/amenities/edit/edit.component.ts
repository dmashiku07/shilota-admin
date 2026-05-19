import {
  Component,
  OnInit,
  ElementRef,
  ViewChild,
  ViewContainerRef
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AmenitiesService } from '../../../../../service/amenities.service';
import {
  UntypedFormGroup,
  UntypedFormBuilder,
  Validators,
  FormArray,
  NgForm,
  FormsModule,
  ReactiveFormsModule
} from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { FileValidator } from '../../../../../provider/file-input.validator';
import { environment } from '../../.././../../../environments/environment';
@Component({
  standalone: false,
selector: 'app-edit',
  templateUrl: './edit.component.html',
  styleUrls: ['./edit.component.css']
})
export class EditComponent implements OnInit {
  @ViewChild('image') image;
  amenities: any;
  Form: UntypedFormGroup;
  url: any;
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private service: AmenitiesService,
    private fb: UntypedFormBuilder,
    private elem: ElementRef,
    public toastr: ToastrService,
    vcr: ViewContainerRef
  ) {
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
  ngOnInit() {
    this.url = environment.apiUrl;
    this.route.params.subscribe(params => {
      this.amenities = this.service.edit(params['id']).subscribe(res => {
        this.amenities = res;
      });
    });
  }
  update(form) {
    this.route.params.subscribe(params => {
      let files = this.elem.nativeElement.querySelector('#image').files;
      if (files && files.length > 0) {
        if (!this.validateFile(files[0].name)) {
          this.toastr.error('Support File Format - png,jpeg,jpg ');
        } else {
          let formData = new FormData();
          let file = files[0];
          formData.append('name', form.name);
          formData.append('image', file, form.image);
          this.service.updatePage(formData, params['id']).subscribe(data => {
            if (data['success']) {
              this.toastr.success(data['msg']);
              this.router.navigate(['admin/amenities/view']);
            }
            if (data['error']) {
              this.toastr.error(data['msg']);
            }
          });
        }
      } else {
        let formData = new FormData();
        formData.append('name', form.name);
        this.service.updatePage(formData, params['id']).subscribe(data => {
          if (data['success']) {
            this.toastr.success(data['msg']);
            this.router.navigate(['admin/amenities/view']);
          }
          if (data['error']) {
            this.toastr.error(data['msg']);
          }
        });
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
