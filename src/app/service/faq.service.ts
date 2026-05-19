import { map } from 'rxjs/operators';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
const API_URL = environment.apiUrl + '/faqroutes';
@Injectable()
export class FaqService {
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
    const uri = API_URL + '/add';
    const obj = {
      title: page.title,
      content: page.content,
      status: 1,
    };
    return this.http.post(uri, obj).pipe(
      map(res => res));
  }
  delete(id) {
    const uri = API_URL + '/delete/' + id;
    return this
      .http
      .get(uri).pipe(
        map(res => res));
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
  editadminfaq(id) {
    const uri = API_URL + '/editfaq/' + id;
    return this
      .http
      .get(uri).pipe(
        map(res => {
          return res;
        }));
  }
  update(page, id) {
    const uri = API_URL + '/update/' + id;
    const obj = {
      title: page.title,
      content: page.content
    };
    return this
      .http
      .post(uri, obj).pipe(
        map(res => res));
  }
  getCount() {
    const uri = API_URL + '/faqCount';
    return this
      .http
      .get(uri).pipe(
        map(res => res));
  }
}
