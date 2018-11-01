import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { WatchData } from '../models/watcher';


@Injectable({
  providedIn: 'root'
})
export class SiteService {
  constructor(private _http: HttpClient) { }

  getSites(accountId) {
    return this._http.get(`${environment.apiUrl}/sites/${accountId}`);
  }

  getWatchers(accountId) {
    return this._http.get<WatchData[]>(`${environment.apiUrl}/watchers/${accountId}`);
  }
}
