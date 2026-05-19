import { map } from "rxjs/operators";
import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { FormGroup,  FormBuilder,  Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { environment } from "../../environments/environment";
const API_URL = environment.apiUrl + "/user";
@Injectable()
export class UserService {
  constructor(private http: HttpClient) {}
  getPage(params: any = {}) {
    return this.http.get(API_URL, { params }).pipe(map(res => res));
  }
  deactiveUser(id) {
    return this.http
      .post(API_URL + "/deactive/" + id, id)
      .pipe(map(res => res));
  }
  activeUser(id) {
    return this.http.post(API_URL + "/active/" + id, id).pipe(map(res => res));
  }
  getInfo(id) {
    return this.http.get(API_URL + "/info/" + id).pipe(map(res => res));
  }
  getcount() {
    return this.http.get(API_URL + "/userCount/").pipe(map(res => res));
  }
  getLatestuser() {
    return this.http.get(API_URL + "/latestUser/").pipe(map(res => res));
  }
  getiosuser() {
    return this.http.get(API_URL + "/iosUser/").pipe(map(res => res));
  }
  getandoriduser() {
    return this.http.get(API_URL + "/andoridUser/").pipe(map(res => res));
  }
  getwebuser() {
    return this.http.get(API_URL + "/webUser/").pipe(map(res => res));
  }
  getDeletedUser(params: any = {}) {
    return this.http.get(API_URL + "/deletedusers/", { params }).pipe(map(res => res));
  }
  revokeDeletion(id) {
    return this.http.post(API_URL + "/revokedeletion/" + id, id).pipe(map(res => res));
  }
  sendNotification(Form) {
    const obj = {
      message: Form.message,
      user: Form.user
    };
    return this.http.post(API_URL + "/pushNotify", obj).pipe(map(res => res));
  }
}
