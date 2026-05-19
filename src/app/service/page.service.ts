import {map} from 'rxjs/operators';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
const API_URL = environment.apiUrl+'/page';
@Injectable()
export class PageService {
  constructor(private http: HttpClient) { }
  addPage(page) {
    const obj = {
      title: page.title,
      content: page.content,
      pagetype:page.pagetype,
      status:1,
      type:'driver',
    };
   return  this.http.post(API_URL+'/add', obj).pipe(
   map(res => res));
  }
  addUser(page) {
    const obj = {
      title: page.title,
      content: page.content,
      pagetype:page.pagetype,
      status:1,
      type:'user',
    };
   return  this.http.post(API_URL+'/addUser', obj).pipe(
   map(res => res));
  }
  getPage() {
    return this
            .http
            .get(API_URL).pipe(
            map(res => {
              return res;
            }));
  }
  getUserPage() {
    return this
            .http
            .get(API_URL+'/viewUser').pipe(
            map(res => {
              return res;
            }));
  }
  getTerms() {
    return this
            .http
            .get(API_URL+'/terms').pipe(
            map(res => {
              return res;
            }));
  }
  getPrivacy() {
    return this
            .http
            .get(API_URL+'/privacy').pipe(
            map(res => {
              return res;
            }));
  }
  getUserHelpcontent() {
    return this
            .http
            .get(API_URL+'/userHelp').pipe(
            map(res => {
              return res;
            }));
  }
  getDriverHelpcontent() {
    return this
            .http
            .get(API_URL+'/driverHelp').pipe(
            map(res => {
              return res;
            }));
  }
  getDriverTerms() {
    return this
            .http
            .get(API_URL+'/termsDriver').pipe(
            map(res => {
              return res;
            }));
  }
  getDriverPrivacy() {
    return this
            .http
            .get(API_URL+'/privacyDriver').pipe(
            map(res => {
              return res;
            }));
  }
  getDriverInspection() {
    return this
            .http
            .get(API_URL+'/inspectionDriver').pipe(
            map(res => {
              return res;
            }));
  }
  getDriverSecurity() {
    return this
            .http
            .get(API_URL+'/securityDriver').pipe(
            map(res => {
              return res;
            }));
  }
  deletePage(id) {
        return this
            .http
            .get(API_URL+'/delete/'+ id).pipe(
            map(res => res));
  }
  editPage(id) {
    return this
            .http
            .get(API_URL+'/edit/'+ id).pipe(
            map(res => {
              return res;
            }));
  }
  editDriverPage(id) {
    return this
            .http
            .get(API_URL+'/editdriverpage/'+ id).pipe(
            map(res => {
              return res;
            }));
  }
  updatePage(page, id) {
    const obj = {
      title: page.title,
      content: page.content
    };
    return this
      .http
      .post(API_URL+'/update/'+ id, obj)
      .pipe(map(res => res));
  }
  getSocial() {
    return this
            .http
            .get(API_URL+'/social/').pipe(
            map(res => {
              return res;
            }));
  }
  getdriverHelpCount() {
    const uri = API_URL+'/driverHelpCount';
    return this
            .http
            .get(uri).pipe(
            map(res => {
              return res;
            }));
  }
  getuserHelpCount() {
    const uri = API_URL+'/userHelpCount';
    return this
            .http
            .get(uri).pipe(
            map(res => {
              return res;
            }));
  }
  getDriverHelppage() {
    return this
            .http
            .get(API_URL+'/getDriverHelppage').pipe(
            map(res => {
              return res;
            }));
  }
}
