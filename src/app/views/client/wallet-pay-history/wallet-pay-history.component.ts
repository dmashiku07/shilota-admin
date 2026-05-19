import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { WebappService } from '../../../service/webapp.service';

@Component({
  standalone: false,
selector: 'app-wallet-pay-history',
  templateUrl: './wallet-pay-history.component.html',
  styleUrls: ['./wallet-pay-history.component.scss']
})
export class WalletPayHistoryComponent implements OnInit {
  profileid: any;
  profilelog: any;
  wallethistory: any;
  loadhistory: boolean =false;
  currencySymbol: any = '$';
  constructor(private apiservice: WebappService, private router: Router) {
  }

  ngOnInit() {
    if(localStorage.getItem("CS")) {
      this.currencySymbol = localStorage.getItem("CS");
    }
    this.apiservice.appconfig().subscribe((res: any) => {
      if (res?.status === 'true' && res.currencysymbol) {
        this.currencySymbol = res.currencysymbol;
        localStorage.setItem("CS", this.currencySymbol);
      }
    });
    this.profilelog = JSON.parse(localStorage.getItem('user'));
    if (!this.profilelog?.id) {
      this.router.navigate(['/signin']);
      return;
    }
    this.profileid = this.profilelog.id;
    this.apiservice.wallethistory(this.profileid).subscribe(data => {
      if (data['status'] === 'true'){
        this.wallethistory = data['payment_list'];
        this.loadhistory= true;
      } 
    });
  }
}
