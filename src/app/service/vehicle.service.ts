import { map } from "rxjs/operators";
import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../environments/environment";
const API_URL = environment.apiUrl + "/vehicleRoutes";
@Injectable()
export class VehicleService {
  constructor(private http: HttpClient) { }
  getPage(params: any = {}) {
    return this.http.get(API_URL, { params }).pipe(
      map(res => {
        return res;
      })
    );
  }
  deactiveVehicle(id) {
    return this.http
      .post(API_URL + "/deactive/" + id, id)
      .pipe(map(res => res));
  }
  activeVehicle(id) {
    return this.http.post(API_URL + "/active/" + id, id).pipe(map(res => res));
  }
  getInfo(id) {
    return this.http.get(API_URL + "/info/" + id).pipe(map(res => res));
  }
  getcount() {
    return this.http.get(API_URL + "/totalCount/").pipe(map(res => res));
  }
  getCategory() {
    return this.http.get(API_URL + "/category").pipe(map(res => res));
  }
  edit(id) {
    return this.http.get(API_URL + "/edit/" + id).pipe(map(res => res));
  }
  update(page, id) {
    const obj = {
      category: page.category,
      status: page.status,
      user_id: page.user_id
    };
    return this.http.post(API_URL + "/update/" + id, obj).pipe(map(res => res));
  }
}
