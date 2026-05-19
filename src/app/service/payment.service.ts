import {map} from 'rxjs/operators';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
const API_URL = environment.apiUrl+'/payment';
@Injectable()
export class PaymentService {
  constructor(private http: HttpClient) { }
  getPage(params: any = {}) {
    return this
            .http
            .get(API_URL, { params }).pipe(
            map(res => res));
  }
  getInfo(id){
    return this
            .http
            .get(API_URL+'/info/'+id).pipe(
            map(res => res));
  }
  getDriverPay(params: any = {}){
    return this
            .http
            .get(API_URL+'/totalAmt/', { params }).pipe(
            map(res => res));
  }
  pay(id) {
     return  this.http.post(API_URL+'/paymentDriver', +id).pipe(
   map(res => res));
  }
  getRides(id, params: any = {}){
    return this
            .http
            .get(API_URL+'/getRides/'+id, { params }).pipe(
            map(res => res));
  }
}
