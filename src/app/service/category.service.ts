import {throwError as observableThrowError} from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Injectable } from '@angular/core';
import { HttpClient} from '@angular/common/http';
import { environment } from '../../environments/environment';
const API_URL = environment.apiUrl + '/category';
@Injectable({
  providedIn: 'root'
})
export class CategoryService {
  constructor(private http: HttpClient) { }
  getContent() {
    return this
      .http
      .get(API_URL).pipe(
        map(res => res));
  }
  getBodyType() {
    const uri = API_URL + '/bodytype';
    return this
      .http
      .get(uri).pipe(
        map(res => {
          return res;
        }));
  }
  getAmenities() {
    const uri = API_URL + '/amenities';
    return this
      .http
      .get(uri).pipe(
        map(res => {
          return res;
        }));
  }
  add(formData: any) {
    const uri = API_URL + '/add';
    return this.http.post(uri, formData).pipe(
      catchError(this._errorHandler),
      map(res => res));
  }
  public updateImage(formData: any, id) {
    let _url: string = API_URL + '/updateImage/' + id;
    return this.http.post(_url, formData).pipe(
      catchError(this._errorHandler),
      map(res => res));
  }
  private _errorHandler(error: unknown) {
    console.error('Error Occured: ' + error);
    return observableThrowError(error || 'Some Error on Server Occured');
  }
  edit(id) {
    const uri = API_URL + '/edit/' + id;
    return this
      .http
      .get(uri).pipe(
        map(res => {
          return res;
        }));
  }
  update(formData: any, id) {
    const uri = API_URL + '/update/' + id;
    return this
      .http
      .post(uri, formData).pipe(
        map(res => res));
  }
  delete(id) {
    const uri = API_URL + '/delete/' + id;
    return this
      .http
      .get(uri).pipe(
        map(res => res));
  }
}
