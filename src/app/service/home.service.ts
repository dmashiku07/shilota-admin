import {throwError as observableThrowError} from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
const API_URL = environment.apiUrl + '/home';
@Injectable()
@Injectable()
export class HomeService {
  constructor(private http: HttpClient) { }
  getContent() {
    return this
      .http
      .get(API_URL).pipe(
        map(res => {
          return res;
        }));
  }
  getDriverHome() {
    const uri = API_URL + '/driverhome';
    return this
      .http
      .get(uri).pipe(
        map(res => {
          return res;
        }));
  }
  public uploadImage(formData: any) {
    let _url: string = API_URL + '/upload';
    return this.http.post(_url, formData).pipe(
      catchError(this._errorHandler),
      map(res => res));
  }
  public uploadDriver(formData: any) {
    let _url: string = API_URL + '/uploadDriver';
    return this.http.post(_url, formData).pipe(
      catchError(this._errorHandler),
      map(res => res));
  }
  updatePage(formData: any, id) {
    let _url: string = API_URL + '/update/' + id;
    return this.http.post(_url, formData).pipe(
      catchError(this._errorHandler),
      map(res => res));
  }
  updatePageImage(formData: any, id) {
    let _url: string = API_URL + '/updateImage/' + id;
    return this.http.post(_url, formData).pipe(
      catchError(this._errorHandler),
      map(res => res));
  }
  private _errorHandler(error: unknown) {
    console.error('Error Occured: ' + error);
    return observableThrowError(error || 'Some Error on Server Occured');
  }
  editPage(id) {
    const uri = API_URL + '/edit/' + id;
    return this
      .http
      .get(uri).pipe(
        map(res => res));
  }
  deletePage(id) {
    const uri = API_URL + '/delete/' + id;
    return this
      .http
      .get(uri).pipe(
        map(res => res));
  }
}
