import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable, throwError } from "rxjs";
import { catchError, filter, map, tap } from "rxjs/operators";
import {
  HttpClient,
  HttpHeaders,
  HttpErrorResponse
} from "@angular/common/http";

import { environment } from "../../environments/environment";
const API_URL = environment.apiUrl + "/admin";
@Injectable({
  providedIn: "root"
})
export class AuthenticationService {
  authToken: any;
  user: any;
  _url: string;
  private profileSubject = new BehaviorSubject<any | null>(null);
  private userInfoSubject = new BehaviorSubject<any | null>(null);
  private profileLoading = false;
  private userInfoLoading = false;
  constructor(
    private http: HttpClient
  ) {
    // this.isDev = true;  // Change to false before deployment
  }
  registerUser(user) {
    let headers = new HttpHeaders();
    return this.http
      .post(API_URL + "/register", user, { headers: headers })
      .pipe(map(res => res));
  }
  authenticateUser(user) {
    let headers = new HttpHeaders();
    headers.append("Content-Type", "application/json");
    return this.http
      .post(API_URL + "/authenticate", user, { headers: headers })
      .pipe(map(res => res));
  }

  /* checking jwt token expiration */
  loggedIn() {
    const token: string | null = localStorage.getItem("authtoken");
    if (!token) {
      return false;
    } else {
      return true;
    }
    /* const tokenExpired: boolean = this.jwtHelperService.isTokenExpired(token);
    return !tokenExpired; */
  }

  /* clear the userdata & logout user */
  logout() {
    this.authToken = null;
    this.user = null;
    this.profileLoading = false;
    this.userInfoLoading = false;
    this.profileSubject.next(null);
    this.userInfoSubject.next(null);
    localStorage.clear();
  }

  /* store userdata after successful authentication */
  storeUserData(token, user) {
    localStorage.setItem("authtoken", token);
    localStorage.setItem("user", JSON.stringify(user));
    this.authToken = token;
    this.user = user;
  }

  /* get the stored token */
  loadToken() {
    const token = localStorage.getItem("authtoken");
    this.authToken = token;
  }

  getProfile() {
    if (!this.profileLoading && this.profileSubject.value === null) {
      this.fetchProfile().subscribe();
    }
    return this.profileSubject.asObservable().pipe(
      filter(res => res !== null)
    );
  }

  private fetchProfile() {
    this.loadToken();
    this.profileLoading = true;
    const httpOptions = {
      headers: new HttpHeaders({
        "Content-Type": "application/json",
        "Authorization": localStorage.getItem("authtoken") || ""
      })
    };
    return this.http.get(API_URL + "/profile", httpOptions).pipe(
      map(res => this.normalizeBranding(res)),
      tap(res => {
        this.profileSubject.next(res);
        this.profileLoading = false;
      }),
      catchError(error => {
        this.profileLoading = false;
        return throwError(() => error);
      })
    );
  }
  
  private _errorHandler(error: HttpErrorResponse) {
    console.error("Error Occured: " + error);
    return throwError(() => error || "Some Error on Server Occured");
  }
  updateLogo(formData: any) {
    const uri = API_URL + "/logo/";
    return this.http.post(uri, formData).pipe(
      catchError(this._errorHandler),
      map(res => {
        return res;
      })
    );
  }
  updateFavicon(formData: any) {
    const uri = API_URL + "/favicon/";
    return this.http.post(uri, formData).pipe(
      catchError(this._errorHandler),
      map(res => res)
    );
  }
  updateEmail(user, id) {
    return this.http
      .post(API_URL + "/update/" + id, user)
      .pipe(map(res => res));
  }
  updateSetting(user, id) {
    const obj = {
      username: user.username,
      email: user.email,
      footer: user.footer,
      apptitle: user.apptitle,
      appcontent: user.appcontent,
      phone: user.phone,
      distancePerCab: user.distancePerCab,
      tax: user.tax,
      maxDistance: user.maxDistance,
      currencyCode: user.currencyCode,
      siteName: user.siteName,
      currencySymbol: user.currencySymbol,
      emergencyContact: user.emergencyContact,
      googleMapKey: user.googleMapKey,
      inspectionon: user.inspectionon,
      helppagesheader: user.helppagesheader,
      maxdisperride: user.maxdisperride
    };
    return this.http
      .post(API_URL + "/setting/" + id, obj)
      .pipe(map(res => res));
  }
  updateSMTP(user, id) {
    return this.http.post(API_URL + "/emailSetting/" + id, user);
  }
  getUserinfo() {
    if (!this.userInfoLoading && this.userInfoSubject.value === null) {
      this.fetchUserinfo().subscribe();
    }
    return this.userInfoSubject.asObservable().pipe(
      filter(res => res !== null)
    );
  }

  refreshProfile() {
    return this.fetchProfile();
  }

  refreshUserinfo() {
    return this.fetchUserinfo();
  }

  private fetchUserinfo() {
    this.loadToken();
    this.userInfoLoading = true;
    return this.http.get(API_URL + "/getProfile").pipe(
      map(res => this.normalizeBranding(res)),
      tap(res => {
        this.userInfoSubject.next(res);
        this.userInfoLoading = false;
      }),
      catchError(error => {
        this.userInfoLoading = false;
        return throwError(() => error);
      })
    );
  }

  private normalizeBranding(value: any): any {
    if (typeof value === "string") {
      return value
        .replace(/cabi\.co\.tz/gi, "shilota.tz")
        .replace(/\bcabi\b/gi, "Shilota")
        .replace(/\bcabso\b/gi, "Shilota");
    }

    if (Array.isArray(value)) {
      return value.map(item => this.normalizeBranding(item));
    }

    if (value && typeof value === "object") {
      return Object.keys(value).reduce((next, key) => {
        next[key] = this.normalizeBranding(value[key]);
        return next;
      }, {});
    }

    return value;
  }

  sendMail(form) {
    return this.http.post(API_URL + "/sendMail/", form).pipe(
      map(res => {
        return res;
      })
    );
  }
  ChangePassword(profile, id) {
    return this.http.post(API_URL + "/changePassword/" + id, profile).pipe(
      map(res => {
        return res;
      })
    );
  }
  updateApp(user, id) {
    return this.http.post(API_URL + "/app/" + id, user).pipe(map(res => res));
  }
  updatePayment(payment, id) {
    return this.http
      .post(API_URL + "/payment/" + id, payment)
      .pipe(map(res => res));
  }
}
