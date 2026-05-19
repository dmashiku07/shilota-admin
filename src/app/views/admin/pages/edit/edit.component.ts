import { ChangeDetectorRef, Component, OnInit,ViewContainerRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PageService } from '../../../../service/page.service';
import { UntypedFormGroup,  UntypedFormBuilder,  Validators, FormArray, NgForm,FormsModule, ReactiveFormsModule} from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { Location } from '@angular/common';
@Component({
  standalone: false,
selector: 'app-edit',
  templateUrl: './edit.component.html',
  styleUrls: ['./edit.component.css']
})
export class EditComponent implements OnInit {

  page: any = {};
  Form: UntypedFormGroup;
  isLoading = false;
  constructor(private route: ActivatedRoute,
     private router: Router,
     private service: PageService, private fb: UntypedFormBuilder,
     public toastr: ToastrService, vcr: ViewContainerRef,private location: Location,
     private cdr: ChangeDetectorRef
    ) {
      
    this.createForm();
   }

  createForm() {
    this.Form = this.fb.group({
      title: ['', Validators.compose([Validators.required, Validators.minLength(3),Validators.maxLength(30)])],
      content: ['', Validators.required ],
      pagetype:[''],
   });
  }

  updatePage(page) {
    this.isLoading = true;
    this.cdr.detectChanges();
    this.route.params.subscribe(params => {
      this.service.updatePage(page, params['id']).subscribe(
        data => {
          this.isLoading = false;
          this.cdr.detectChanges();
          if (data['success']) {
            const message = data['msg'] || 'Help Page Content Updated Successfully';
            this.toastr.success(message);
            sessionStorage.setItem("SuccessMessage", message);
            window.scrollTo(0, 0);
            this.location.back();
          }
          if (data['error']) {
            this.toastr.error(data['msg']);
          }
        },
        () => {
          this.isLoading = false;
          this.cdr.detectChanges();
          this.toastr.error('An error occurred', 'Error!');
        }
      );
    });
  }

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.service.editDriverPage(params['id']).subscribe(res => {
        this.page = res || {};
        this.Form.patchValue({
          pagetype: this.page.pagetype || '',
          title: this.page.title || '',
          content: this.page.content || ''
        });
      });
    });
  }
}
