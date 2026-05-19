import { Component, OnInit } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { WebappService } from '../../../service/webapp.service';
import { UntypedFormGroup, UntypedFormBuilder, UntypedFormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SearchCountryField, CountryISO } from 'ngx-intl-tel-input';
import { TranslateService } from '@ngx-translate/core';
import { TranslateModule } from '@ngx-translate/core';
@Component({
  standalone: false,
selector: 'app-add-emergency-contact',
  templateUrl: './add-emergency-contact.component.html',
  styleUrls: ['./add-emergency-contact.component.scss']
})
export class AddEmergencyContactComponent implements OnInit {
  profilelog :any;
  profileid: any;
  requestData: any;
  addContactForm: UntypedFormGroup;
  emergency_contact_list: any;
  separateDialCode = true;
  SearchCountryField = SearchCountryField;
  CountryISO = CountryISO;
  preferredCountries: CountryISO[] = [CountryISO.UnitedStates, CountryISO.UnitedKingdom];
  constructor(private apiservice: WebappService,
    public toastr: ToastrService, private fb: UntypedFormBuilder, private router: Router,   private translate: TranslateService,) {
    this.addContactForm = this.fb.group({
      contact_name: ['', Validators.required],
      contact_no: ['', Validators.required]
    });
  }

  ngOnInit() {
    this.profilelog = JSON.parse(localStorage.getItem('user'));
    this.profileid = this.profilelog.id;
    this.apiservice.profiledetails(this.profileid).subscribe(data => {
      if (data['status'] === 'true') {
        this.emergency_contact_list = data['emergency_contact'];
      } else {
        this.toastr.error(this.translate.instant(data['message']));
        window.scrollTo(0, 0);
      }
    });
  }

  onProfileSubmit(formdata) {
    if (this.addContactForm.valid) {
      this.profilelog = JSON.parse(localStorage.getItem('user'));
      this.profileid = this.profilelog.id;
      this.emergency_contact_list.push({
        phone_no: formdata.contact_no.internationalNumber,
        country_code: formdata.contact_no.countryCode.toLowerCase(),
        name: formdata.contact_name,
      });
      const requestData = {
        user_id: this.profileid,
        emergency_contact: JSON.stringify(this.emergency_contact_list)
      };
      this.apiservice.profileupdate(requestData).subscribe(data => {
        if (data['status'] === 'true') {
          this.router.navigate(['/emergency-contacts']);
          this.toastr.success(this.translate.instant(data['message']));
          window.scrollTo(0, 0);
        } else {
          this.toastr.error(this.translate.instant(data['message']));
          window.scrollTo(0, 0);
        }
      });
    } else {
      this.validateAllFormFields(this.addContactForm);
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

  numberOnly(event): boolean {
    const charCode = event.which ? event.which : event.keyCode;
    if (charCode > 31 && (charCode < 48 || charCode > 57)) {
      return false;
    }
    return true;
  }

charOnly(event): boolean {
   
    const charCode = event.which ? event.which : event.keyCode;

    if (
      charCode > 32 &&
      (charCode < 65 || charCode > 90) &&
      (charCode < 97 || charCode > 122 )
    ) {
      var hebrewAlphabetDigits =  /^[א-ת\s]+$/;
      var arabicAlphabetDigits = /[\u0600-\u06ff]|[\u0750-\u077f]|[\ufb50-\ufc3f]|[\ufe70-\ufefc]|[\u0200]|[\u00A0]/g;
      var key = String.fromCharCode(event.which);
      if (event.keyCode == 8 || event.keyCode == 37 || event.keyCode == 39 || arabicAlphabetDigits.test(key) || hebrewAlphabetDigits.test(key)) {
        return true;
      }
      
      return false;
    }
    return true;
  }
}