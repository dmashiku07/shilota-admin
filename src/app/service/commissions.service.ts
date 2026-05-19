import {map} from 'rxjs/operators';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
const API_URL = environment.apiUrl+'/tax';
@Injectable()
export class CommissionsService {
  constructor(private http: HttpClient) { }
  getContent() {
    return this
            .http
            .get(API_URL).pipe(
            map(res => {
              return res;
            }));
  }
  add(page) {
    const uri = API_URL+'/add';
    const obj = {
      price_from: page.price_from,
      price_to: page.price_to,
      percentage:page.percentage,
    };
   return  this.http.post(uri, obj).pipe(
   map(res => res));
  }
  delete(id) {
    const uri = API_URL+'/delete/' + id;
        return this
            .http
            .get(uri).pipe(
            map(res => res));
  }
  edit(id) {
    const uri = API_URL+'/edit/' + id;
    return this
            .http
            .get(uri).pipe(
            map(res => res));
  }
  update(page, id) {
    const uri = API_URL+'/update/' + id;
    const obj = {
      price_from: page.price_from,
      price_to: page.price_to,
      percentage:page.percentage,
    };
    return  this
      .http
      .post(uri, obj).pipe(
      map(res => res));
  }
}
