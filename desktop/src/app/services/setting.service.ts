import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SettingService {
  constructor(private _httpClient: HttpClient) { }

  getSetting(name) {
    return this._httpClient.get(`${environment.apiUrl}/settings/${name}`);
  }

  updateSetting(name, value) {
    return this._httpClient.put(environment.apiUrl + '/settings/' + name, {
      value: value
    });
  }
}
