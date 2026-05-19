import {map} from 'rxjs/operators';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
const API_URL = environment.apiUrl+'/driverRoutes';
@Injectable()
export class DriverService {
  constructor(private http: HttpClient) { }
  getPage(params: any = {}) {
    return this
            .http
            .get(API_URL, { params }).pipe(
            map(res => {
              return res;
            }));
  }
  deactiveUser(id) {
    const uri = API_URL+'/deactive/'+id;
    return  this.http.post(uri, id).pipe(
   map(res => res));
  }
  activeUser(id) {
    const uri = API_URL+'/active/'+id;
    return  this.http.post(uri, id).pipe(
   map(res => res));
  }
  getInfo(id){
    const uri = API_URL+'/info/' + id;
    return this
            .http
            .get(uri).pipe(
            map(res => {
              return res;
            }));
  }
  getcount(){
    const uri = API_URL+'/driverCount/';
    return this
            .http
            .get(uri).pipe(
            map(res => res));
  }
  getonlineDrivercount(){
    const uri = API_URL+'/onlineDriver/';
    return this
            .http
            .get(uri).pipe(
            map(res => res));
  }
  getactiveDrivercount(){
    const uri = API_URL+'/activeDriver/';
    return this
            .http
            .get(uri).pipe(
            map(res => res));
  }
  getDeletedDriver(params: any = {}) {
    return this.http.get(API_URL + "/deleteddrivers/", { params }).pipe(map(res => res));
  }
  revokeDeletion(id) {
    return this.http.post(API_URL + "/revokedeletion/" + id, id).pipe(map(res => res));
  }
}
