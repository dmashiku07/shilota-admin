import { map } from 'rxjs/operators';
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';

const API_URL = environment.apiUrl + '/subscriptions';

@Injectable()
export class SubscriptionService {
  constructor(private http: HttpClient) {}

  getPage(params: any = {}) {
    return this.http.get(API_URL, { params }).pipe(map(res => res));
  }

  grant(payload: any) {
    return this.http.post(API_URL + '/grant', payload, this.adminOptions()).pipe(map(res => res));
  }

  revoke(id: string, reason: string) {
    return this.http.post(API_URL + '/' + id + '/revoke', { reason }, this.adminOptions()).pipe(map(res => res));
  }

  private adminOptions() {
    return {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
        'Authorization': localStorage.getItem('authtoken') || ''
      })
    };
  }
}
