import { Injectable } from "@angular/core";
import { map } from "rxjs/operators";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { environment } from "../../environments/environment";
const API_URL = environment.apiUrl + "/api";

@Injectable({
  providedIn: "root"
})
export class WebappService {
  constructor(private http: HttpClient) { }

  accountsignin(formData: any) {
    const uri = API_URL + "/signin";
    return this.http.post(uri, formData).pipe(
      map(res => {
        return res;
      })
    );
  }

  accountsignup(formData: any) {
    const uri = API_URL + "/signup";
    return this.http.post(uri, formData).pipe(
      map(res => {
        return res;
      })
    );
  }

  profiledetails(id) {
    const uri = API_URL + "/profile/" + id;
    const httpOptions = {
      headers: new HttpHeaders({
        "Content-Type": "application/json",
        Authorization: localStorage.getItem("authtoken")
      })
    };
    return this.http.get(uri, httpOptions).pipe(
      map(res => {
        return res;
      })
    );
  }

  profileupdate(formData: any) {
    const uri = API_URL + "/updateprofile/";
    const httpOptions = {
      headers: new HttpHeaders({
        "Content-Type": "application/json",
        Authorization: localStorage.getItem("authtoken")
      })
    };
    return this.http.post(uri, formData, httpOptions).pipe(map(res => res));
  }

  updateProfilePic(formData: any) {
    const uri = API_URL + "/uploadprofileimage";
    const httpOptions = {
      headers: new HttpHeaders({
        Authorization: localStorage.getItem("authtoken")
      })
    };
    return this.http.post(uri, formData, httpOptions).pipe(
      map(res => {
        return res;
      })
    );
  }

  changepassword(formData: any) {
    const uri = API_URL + "/updatepassword/";
    const httpOptions = {
      headers: new HttpHeaders({
        "Content-Type": "application/json",
        Authorization: localStorage.getItem("authtoken")
      })
    };
    return this.http.post(uri, formData, httpOptions).pipe(map(res => res));
  }

  changephoneno(formData: any) {
    const uri = API_URL + "/updatephonenumber/";
    return this.http.post(uri, formData).pipe(map(res => res));
  }

  forgotpassword(formData: any) {
    const uri = API_URL + "/resetpassword/";
    return this.http.post(uri, formData).pipe(map(res => res));
  }

  braintreetoken(formData: any) {
    const uri = API_URL + "/getclienttoken";
    const httpOptions = {
      headers: new HttpHeaders({
        "Content-Type": "application/json",
        Authorization: localStorage.getItem("authtoken")
      })
    };
    return this.http.post(uri, formData, httpOptions).pipe(
      map(res => {
        return res;
      })
    );
  }

  creditwallet(formData: any) {
    const uri = API_URL + "/addmoney";
    const httpOptions = {
      headers: new HttpHeaders({
        "Content-Type": "application/json",
        Authorization: localStorage.getItem("authtoken")
      })
    };
    return this.http.post(uri, formData, httpOptions).pipe(
      map(res => {
        return res;
      })
    );
  }

  wallethistory(id) {
    const uri = API_URL + "/wallethistory/" + id;
    const httpOptions = {
      headers: new HttpHeaders({
        "Content-Type": "application/json",
        Authorization: localStorage.getItem("authtoken")
      })
    };
    return this.http.get(uri, httpOptions).pipe(
      map(res => {
        return res;
      })
    );
  }

  accountexists(formData: any) {
    const uri = API_URL + "/checkaccountexists";
    return this.http.post(uri, formData).pipe(
      map(res => {
        return res;
      })
    );
  }

  showallcategories() {
    const uri = API_URL + "/allcategories";
    return this.http.get(uri).pipe(
      map(res => {
        return res;
      })
    );
  }

  shownearbycategories(formData: any) {
    const uri = API_URL + "/grabrides";
    return this.http.post(uri, formData).pipe(
      map(res => {
        return res;
      })
    );
  }

  getnotification(id) {
    const uri = API_URL + "/notifications/" + id;
    const httpOptions = {
      headers: new HttpHeaders({
        "Content-Type": "application/json",
        Authorization: localStorage.getItem("authtoken")
      })
    };
    return this.http.get(uri, httpOptions).pipe(map(res => res));
  }

  requestride(formData: any) {
    const uri = API_URL + "/requestride";
    const httpOptions = {
      headers: new HttpHeaders({
        "Content-Type": "application/json",
        Authorization: localStorage.getItem("authtoken")
      })
    };
    return this.http.post(uri, formData, httpOptions).pipe(
      map(res => {
        return res;
      })
    );
  }

  confirmride(formData: any) {
    const uri = API_URL + "/confirmride";
    const httpOptions = {
      headers: new HttpHeaders({
        "Content-Type": "application/json",
        Authorization: localStorage.getItem("authtoken")
      })
    };
    return this.http.post(uri, formData, httpOptions).pipe(
      map(res => {
        return res;
      })
    );
  }

  lastrequestedride(id) {
    const uri = API_URL + "/lastridedetails/" + id;
    return this.http.get(uri).pipe(map(res => res));
  }

  ridehistory(formData: any) {
    const uri = API_URL + "/ridehistory";
    const httpOptions = {
      headers: new HttpHeaders({
        "Content-Type": "application/json",
        Authorization: localStorage.getItem("authtoken")
      })
    };
    return this.http.post(uri, formData, httpOptions).pipe(
      map(res => {
        return res;
      })
    );
  }

  cancelride(formData: any) {
    const uri = API_URL + "/cancelride";
    const httpOptions = {
      headers: new HttpHeaders({
        "Content-Type": "application/json",
        Authorization: localStorage.getItem("authtoken")
      })
    };
    return this.http.post(uri, formData, httpOptions).pipe(
      map(res => {
        return res;
      })
    );
  }

  rideinprogress(formData: any) {
    const uri = API_URL + "/ongoingrideindetail";
    const httpOptions = {
      headers: new HttpHeaders({
        "Content-Type": "application/json",
        Authorization: localStorage.getItem("authtoken")
      })
    };
    return this.http.post(uri, formData, httpOptions).pipe(
      map(res => {
        return res;
      })
    );
  }

  ridecompleted(formData: any) {
    const uri = API_URL + "/completeridedetails";
    const httpOptions = {
      headers: new HttpHeaders({
        "Content-Type": "application/json",
        Authorization: localStorage.getItem("authtoken")
      })
    };
    return this.http.post(uri, formData, httpOptions).pipe(
      map(res => {
        return res;
      })
    );
  }

  rideincompleted(formData: any) {
    const uri = API_URL + "/incompleterideindetail";
    const httpOptions = {
      headers: new HttpHeaders({
        "Content-Type": "application/json",
        Authorization: localStorage.getItem("authtoken")
      })
    };
    return this.http.post(uri, formData, httpOptions).pipe(
      map(res => {
        return res;
      })
    );
  }

  reviewaride(formData: any) {
    const uri = API_URL + "/review";
    const httpOptions = {
      headers: new HttpHeaders({
        "Content-Type": "application/json",
        Authorization: localStorage.getItem("authtoken")
      })
    };
    return this.http.post(uri, formData, httpOptions).pipe(
      map(res => {
        return res;
      })
    );
  }

  ridedetails(formData: any) {
    const uri = API_URL + "/ridedetails";
    const httpOptions = {
      headers: new HttpHeaders({
        "Content-Type": "application/json",
        Authorization: localStorage.getItem("authtoken")
      })
    };
    return this.http.post(uri, formData, httpOptions).pipe(
      map(res => {
        return res;
      })
    );
  }

  cashpayment(formData: any) {
    const uri = API_URL + "/paybycash";
    const httpOptions = {
      headers: new HttpHeaders({
        "Content-Type": "application/json",
        Authorization: localStorage.getItem("authtoken")
      })
    };
    return this.http.post(uri, formData, httpOptions).pipe(
      map(res => {
        return res;
      })
    );
  }

  cardpayment(formData: any) {
    const uri = API_URL + "/paybycard";
    const httpOptions = {
      headers: new HttpHeaders({
        "Content-Type": "application/json",
        Authorization: localStorage.getItem("authtoken")
      })
    };
    return this.http.post(uri, formData, httpOptions).pipe(
      map(res => {
        return res;
      })
    );
  }

  appconfig() {
    const uri = API_URL + "/admindatas";
    return this.http.get(uri).pipe(
      map(res => {
        return res;
      })
    );
  }

  deviceSignin(formData) {
    const uri = API_URL + "/pushsignin";
    const httpOptions = {
      headers: new HttpHeaders({
        "Content-Type": "application/json",
        Authorization: localStorage.getItem("authtoken")
      })
    };
    return this.http.post(uri, formData, httpOptions).pipe(
      map(res => {
        return res;
      })
    );
  }

  nodriverfound(formData) {
    const uri = API_URL + "/nooneaccept";
    const httpOptions = {
      headers: new HttpHeaders({
        "Content-Type": "application/json",
        Authorization: localStorage.getItem("authtoken")
      })
    };
    return this.http.post(uri, formData, httpOptions).pipe(
      map(res => {
        return res;
      })
    );
  }

  webSignin(formData) {
    const uri = API_URL + "/appsignin";
    return this.http.post(uri, formData).pipe(
      map(res => {
        return res;
      })
    );
  }

  webSigninout(formData) {
    const uri = API_URL + "/appsignout";
    return this.http.post(uri, formData).pipe(
      map(res => {
        return res;
      })
    );
  }

  accountDelete(formData) {
    const uri = API_URL + "/accountdelete";
    return this.http.post(uri, formData).pipe(
      map(res => {
        return res;
      })
    );
  }
}
