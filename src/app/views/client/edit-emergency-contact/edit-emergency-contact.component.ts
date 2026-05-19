import { Component, OnInit,SimpleChanges } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { WebappService } from '../../../service/webapp.service';
import { UntypedFormGroup, UntypedFormBuilder, UntypedFormControl, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { SearchCountryField, CountryISO } from 'ngx-intl-tel-input';
import { TranslateService } from '@ngx-translate/core';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  standalone: false,
selector: 'app-edit-emergency-contact',
  templateUrl: './edit-emergency-contact.component.html',
  styleUrls: ['./edit-emergency-contact.component.scss']
})
export class EditEmergencyContactComponent implements OnInit {
  profileid: any;
  profilelog: any;
  emergency_contact_list: any;
  contact_info: any;
  requestData: any;
  editparam : number;
  editContactForm: UntypedFormGroup;
  separateDialCode = true;
  SearchCountryField = SearchCountryField;
  CountryISO = CountryISO;
  CountrySelected = "us";
  preferredCountries: CountryISO[] = [CountryISO.UnitedStates, CountryISO.UnitedKingdom];
  constructor(private apiservice: WebappService,
    public toastr: ToastrService, private translate: TranslateService, private fb: UntypedFormBuilder, private router: Router, private route: ActivatedRoute) {
    this.editContactForm = this.fb.group({
      contact_name: ['', Validators.required],
      contact_no: ['', Validators.required]
    });
  }

  ngOnInit() {
    this.profilelog = JSON.parse(localStorage.getItem('user'));
    this.profileid = this.profilelog.id;
    this.apiservice.profiledetails(this.profileid).subscribe(data => {
      if (data['status'] === 'true') {
        this.route.params.subscribe(params => {
        this.emergency_contact_list = data['emergency_contact'];
        this.editparam = params['id'] - 1;
        this.contact_info = this.emergency_contact_list[this.editparam];
        this.CountrySelected= this.contact_info.country_code;
        });
      } else {
        this.toastr.error(this.translate.instant(data['message']));
        window.scrollTo(0, 0);
      }
    });
  }

  onProfileSubmit(formdata) {
    if (this.editContactForm.valid) {
      this.emergency_contact_list.splice(this.editparam, 1);
      this.profilelog = JSON.parse(localStorage.getItem('user'));
      this.profileid = this.profilelog.id;
      this.emergency_contact_list.push({
        phone_no: formdata.contact_no.internationalNumber,
        name: formdata.contact_name,
        country_code: formdata.contact_no.countryCode.toLowerCase(),
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
      this.validateAllFormFields(this.editContactForm);
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