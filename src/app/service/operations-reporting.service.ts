import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable()
export class OperationsReportingService {
  private readonly apiUrl = environment.apiUrl + '/admin';

  constructor(private http: HttpClient) {}

  private options(params: any = {}) {
    return {
      params,
      headers: new HttpHeaders({ Authorization: localStorage.getItem('authtoken') || '' })
    };
  }

  getLatraSummary() {
    return this.http.get(this.apiUrl + '/latra/summary', this.options());
  }

  getLatraSubmissions(params: any) {
    return this.http.get(this.apiUrl + '/latra/submissions', this.options(params));
  }

  getDisbursements(params: any) {
    return this.http.get(this.apiUrl + '/disbursements', this.options(params));
  }
}
