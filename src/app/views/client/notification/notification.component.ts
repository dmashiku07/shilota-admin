import { Component, OnInit } from '@angular/core';
import { WebappService } from '.././../../service/webapp.service';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthenticationService } from '.././../../service/authentication.service';
const isDefined = (value: any): boolean => value !== undefined && value !== null;
import { environment } from '.././../../../environments/environment';
import { TranslateService } from '@ngx-translate/core';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  standalone: false,
selector: 'app-notification',
  templateUrl: './notification.component.html',
  styleUrls: ['./notification.component.scss']
})
export class NotificationComponent implements OnInit {
  profileid: any;
  profilelog: any;
  notification: any;
    newnotification: any;
  notificationStatus: any;
  ad_unit_id:any;
  admin_enable_ads:any;
  constructor(private apiservice: WebappService,  private translate: TranslateService, private router: Router) {
    this.notificationStatus = false;
  }

  ngOnInit() {
    this.profilelog = JSON.parse(localStorage.getItem('user'));
    this.profileid = this.profilelog.id;
    this.ad_unit_id = this.profilelog.ad_unit_id;
    this.admin_enable_ads=this.profilelog.admin_enable_ads;
    this.apiservice.getnotification(this.profileid).subscribe(data => {
      if (data['status'] === 'true') {
        if (isDefined(data['result'])) {
          this.notification = data['result'];
          this.notificationStatus = true;
          this.notification.forEach(function(notification_data){
          if(notification_data.title=="Wallet Credited")  {
             
              var splitted = notification_data.message.split("Your wallet has been credited & wallet balance is "); 
         
              notification_data.message = splitted[1];
            
          }
            else
              notification_data.message = notification_data.message;
        });  

        } else {
          this.notification = '';
        }
      }
    });
  }
}
