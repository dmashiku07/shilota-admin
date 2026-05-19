import { ChangeDetectorRef, Component, OnInit, ElementRef, ViewContainerRef } from '@angular/core';
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
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CategoryService } from '../../../../../service/category.service';
import { Observable } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { FileValidator } from '../../../../../provider/file-input.validator';
import { environment } from '../../../../../../environments/environment';

@Component({
  standalone: false,
selector: 'app-edit',
  templateUrl: './edit.component.html',
  styleUrls: ['./edit.component.css']
})
export class EditComponent implements OnInit {
  category: any = {};
  Form: UntypedFormGroup;
  types: any[] = [];
  facility: any[] = [];
  amenities: any[] = [];
  data: any;
  url: any;
  isLoading = false;
  amenitiesDropdownOpen = false;
  constructor(
    private service: CategoryService,
    private fb: UntypedFormBuilder,
    private elem: ElementRef,
    private router: Router,
    public toastr: ToastrService,
    vcr: ViewContainerRef,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.url = environment.apiUrl;
    this.createForm();
    this.route.params.subscribe(params => {
      this.service.edit(params['id']).subscribe(res => {
        this.category = res || {};
        const selectedAmenities = Array.isArray(this.category.amenities)
          ? this.category.amenities.map((item: any) => item?.name || item).filter(Boolean)
          : String(this.category.amenities || '').split(',').map((item: string) => item.trim()).filter(Boolean);
        this.Form.patchValue({
          category_name: this.category.category_name || '',
          category_desc: this.category.category_desc || '',
          bodytypes: this.category.bodytypes || '',
          amenities: selectedAmenities,
          unitprice: this.category.unitprice || '',
          baseprice: this.category.baseprice || ''
        });
        this.cdr.detectChanges();
      });
    });

    this.service.getBodyType().subscribe(res => {
      this.types = Array.isArray(res) ? res : [];
      this.cdr.detectChanges();
    });

    this.service.getAmenities().subscribe(res => {
      this.facility = Array.isArray(res) ? res : [];
      this.cdr.detectChanges();
    });
  }
  createForm() {
    this.Form = this.fb.group({
      category_name: [
        '',
        Validators.compose([
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(30)
        ])
      ],
      category_desc: ['', Validators.required],
      bodytypes: [''],
      amenities: [''],
      unitprice: ['',Validators.required],
      baseprice: ['',Validators.required],
      image: ['']
    },{ validator: [this.checkUnitPrice,this.checkBasePrice]});
  }

  get selectedAmenities(): string[] {
    const amenities = this.Form && this.Form.get('amenities') ? this.Form.get('amenities').value : [];
    return Array.isArray(amenities) ? amenities : [];
  }

  toggleAmenitiesDropdown(): void {
    this.amenitiesDropdownOpen = !this.amenitiesDropdownOpen;
  }

  isAmenitySelected(name: string): boolean {
    return this.selectedAmenities.indexOf(name) >= 0;
  }

  toggleAmenity(name: string): void {
    const nextSelection = this.isAmenitySelected(name)
      ? this.selectedAmenities.filter(item => item !== name)
      : [...this.selectedAmenities, name];
    this.Form.get('amenities').setValue(nextSelection);
    this.Form.get('amenities').markAsTouched();
  }

  checkUnitPrice(group: UntypedFormGroup) {
    let price = parseInt(group.controls.unitprice.value);
    return price > 0 ? null : { unitPriceError: true };
  }

  checkBasePrice(group: UntypedFormGroup) {
    let price = parseInt(group.controls.baseprice.value);
    return price > 0 ? null : { basePriceError: true };
  }

  update(Form) {
    if (this.Form.valid) {
      this.isLoading = true;
      this.cdr.detectChanges();
      this.route.params.subscribe(params => {
        let files = this.elem.nativeElement.querySelector('#image').files;
        if (files && files.length > 0) {
          if (!this.validateFile(files[0].name)) {
            this.toastr.error('Support File Format - png,jpeg,jpg ');
            this.isLoading = false;
            this.cdr.detectChanges();
          } else {
            let formData = new FormData();
            let file = files[0];
            formData.append('image', file, file.name);
            formData.append('category_name', Form.category_name);
            formData.append('category_desc', Form.category_desc);
            formData.append('bodytypes', Form.bodytypes);
            formData.append('amenities', this.selectedAmenities.join(','));
            formData.append('unitprice', Form.unitprice);
            formData.append('baseprice', Form.baseprice);

            this.service.update(formData, params['id']).subscribe(
              data => {
                this.isLoading = false;
                this.cdr.detectChanges();
                if (data['success']) {
                  this.toastr.success(data['msg']);
                  sessionStorage.setItem('SuccessMessage', data['msg']);
                  this.router.navigate(['admin/category/view']);
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
          let formData = new FormData();
          formData.append('category_name', Form.category_name);
          formData.append('category_desc', Form.category_desc);
          formData.append('bodytypes', Form.bodytypes);
          formData.append('amenities', this.selectedAmenities.join(','));
          formData.append('unitprice', Form.unitprice);
          formData.append('baseprice', Form.baseprice);

          this.service.update(formData, params['id']).subscribe(
            data => {
              this.isLoading = false;
              this.cdr.detectChanges();
              if (data['success']) {
                this.toastr.success(data['msg']);
                sessionStorage.setItem('SuccessMessage', data['msg']);
                this.router.navigate(['admin/category/view']);
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
      });
    } else {
      this.validateAllFormFields(this.Form);
    }
  }

  validateFile(name: String) {
    var ext = name.substring(name.lastIndexOf('.') + 1);
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
