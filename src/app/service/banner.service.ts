import {throwError as observableThrowError} from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Injectable } from '@angular/core';
import { HttpClient} from '@angular/common/http';

import { environment } from '../../environments/environment';
const API_URL = environment.apiUrl + '/banner';
@Injectable()
export class BannerService {

  constructor(private http: HttpClient) { }

  getContent() {
    return this
      .http
      .get(API_URL).pipe(
        map(res => {
          return res;
        }));
  }

  public addBanner(formData: any) {
    let _url: string = API_URL + '/add';
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
        map(res => {
          return res;
        }));
  }

  updatePage(formData: any, id) {
    const uri = API_URL + '/update/' + id;

    return this
      .http
      .post(uri, formData).pipe(
        catchError(this._errorHandler),
        map(res => res));
  }


  updatePageImage(formData: any, id) {
    let _url: string = API_URL + '/updateImage/' + id;
    return this.http.post(_url, formData).pipe(
      catchError(this._errorHandler),
      map(res => res));
  }

  //home page

  getUserBanner() {
    const uri = API_URL + '/user';
    return this
      .http
      .get(uri).pipe(
        map(res => {
          return res;
        }));
  }

  getDriverBanner() {
    const uri = API_URL + '/driver';
    return this
      .http
      .get(uri).pipe(
        map(res => {
          return res;
        }));
  }


  deletePage(id) {
    const uri = API_URL + '/delete/' + id;

    return this
      .http
      .get(uri).pipe(
        map(res => res));
  }


  getCount() {
    const uri = API_URL + '/count';
    return this
      .http
      .get(uri).pipe(
        map(res => {
          return res;
        }));
  }

  getUserCount() {
    const uri = API_URL + '/userCount';
    return this
      .http
      .get(uri).pipe(
        map(res => {
          return res;
        }));
  }

  getDriverCount() {
    const uri = API_URL + '/driverCount';
    return this
      .http
      .get(uri).pipe(
        map(res => {
          return res;
        }));
  }
}
