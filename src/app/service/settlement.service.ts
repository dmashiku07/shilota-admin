import { map } from "rxjs/operators";
import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../environments/environment";
const API_URL = environment.apiUrl + "/settlement";
@Injectable()
export class SettlementService {
  constructor(private http: HttpClient) {}
  getPage(params: any = {}) {
    return this.http.get(API_URL, { params }).pipe(
      map(res => {
        return res;
      })
    );
  }
  add(driverID, totalFare, commissionAmt, tax, earn, countpage) {
    const uri = API_URL + "/add";
    const obj = {
      driver_id: driverID,
      total_ridefare: totalFare,
      total_commissionAmt: commissionAmt,
      total_tax: tax,
      total_earning: earn,
      ride_count: countpage,
      payment_status: 1
    };
    return this.http.post(uri, obj).pipe(map(res => res));
  }
  getcount() {
    return this.http.get(API_URL + "/totalCommission/").pipe(map(res => res));
  }
}
