import { map } from 'rxjs/operators';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
const API_URL = environment.apiUrl + '/rides';
@Injectable()
export class RidesService {
  constructor(private http: HttpClient) { }
  getPage(status, params: any = {}) {
    return this
      .http
      .get(API_URL + '/rideindetail/' + status, { params }).pipe(
        map(res => res));
  }
  deactiveVehicle(id) {
    return this.http.post(API_URL + '/deactive/' + id, id).pipe(
      map(res => res));
  }
  activeVehicle(id) {
    return this.http.post(API_URL + '/active/' + id, id).pipe(
      map(res =>res));
  }
  getInfo(id) {
    return this
      .http
      .get(API_URL + '/info/' + id).pipe(
        map(res => res));
  }
  getridePayInfo(id) {
    return this
      .http
      .get(API_URL + '/ridepaymentinfo/' + id).pipe(
        map(res => res));
  }
  getDriverRide(id, params: any = {}) {
    return this
      .http
      .get(API_URL + '/getDriverRide/' + id, { params }).pipe(
        map(res => res));
  }
  getDriverRideCount(id) {
    return this
      .http
      .get(API_URL + '/getDriverRideCount/' + id).pipe(
        map(res => res));
  }
  getcount() {
    return this
      .http
      .get(API_URL + '/totalCount/').pipe(
        map(res => res));
  }
  getcurrentMonthride() {
    return this
      .http
      .get(API_URL + '/currentMonth/').pipe(
        map(res => res));
  }
  getLatestride() {
    return this
      .http
      .get(API_URL + '/latestRide/').pipe(
        map(res => res));
  }
  getCancelCount() {
    return this
      .http
      .get(API_URL + '/cancel/').pipe(
        map(res => res));
  }
  getCompletedCount() {
    return this
      .http
      .get(API_URL + '/completed/').pipe(
        map(res => res));
  }
  rideCounts() {
    return this
      .http
      .get(API_URL + '/rideCounts/').pipe(
        map(res => res));
  }
  getOnthewayCount() {
    return this
      .http
      .get(API_URL + '/ontheway/').pipe(
        map(res => res));
  }
  getScheduledCount() {
    return this
      .http
      .get(API_URL + '/scheduled/').pipe(
        map(res => res));
  }
  getAcceptedCount() {
    return this
      .http
      .get(API_URL + '/accepted/').pipe(
        map(res => res));
  }
  getNotAcceptCount() {
    return this
      .http
      .get(API_URL + '/ridenotaccepted/').pipe(
        map(res => res));
  }
  gettodayCount() {
    return this
      .http
      .get(API_URL + '/currentRecords/').pipe(
        map(res => res));
  }

  getridehistory(formData: any) {
    const uri = API_URL + '/ridehistory';
    return this.http.post(uri, formData).pipe(
      map(res => {
        return res;
      })
    );
  }
}
