import { Component, OnInit, ElementRef, ViewContainerRef } from '@angular/core';
import { UntypedFormGroup, UntypedFormBuilder, UntypedFormControl, Validators, FormArray, NgForm, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CategoryService } from '../../../../../service/category.service';
import { Observable } from 'rxjs';
import { FileValidator } from '../../../../../provider/file-input.validator'
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
  types: any;
  facility: any;
  amenitiesDropdownOpen = false;
  constructor(private service: CategoryService,
    private fb: UntypedFormBuilder,
    private elem: ElementRef,
    private router: Router,
    public toastr: ToastrService, vcr: ViewContainerRef,
  ) {  }
  ngOnInit() {
    this.createForm();
    this.service.getBodyType().subscribe(res => {
      this.types = res;
    });
    this.service.getAmenities().subscribe(res => {
      this.facility = res;
    });
  }
  createForm() {
    this.Form = this.fb.group({
      category_name: ['', Validators.compose([Validators.required, Validators.minLength(3), Validators.maxLength(30)])],
      category_desc: ['', Validators.required],
      bodytypes: ['', Validators.required],
      amenities: ['', Validators.required],
      unitprice: ['', Validators.required],
      baseprice: ['', Validators.required],
      image: ['' ,FileValidator.validate]
    },
    { validator: [this.checkUnitPrice,this.checkBasePrice]});
  }

  checkUnitPrice(group: UntypedFormGroup) {
    let price = parseInt(group.controls.unitprice.value);
    return price > 0 ? null : { unitPriceError: true };
  }

  checkBasePrice(group: UntypedFormGroup) {
    let price = parseInt(group.controls.baseprice.value);
    return price > 0 ? null : { basePriceError: true };
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
  
  add(Form) {
    if (this.Form.valid) {
      let files = this.elem.nativeElement.querySelector('#image').files;
      if (!this.validateFile(files[0].name)) {
        this.toastr.error('Support File Format - png,jpeg,jpg ');
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
        this.service.add(formData).subscribe(data => {
          if (data['success']) {
            sessionStorage.setItem('SuccessMessage', data['msg']);
            this.router.navigate(['admin/category/view']);
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
