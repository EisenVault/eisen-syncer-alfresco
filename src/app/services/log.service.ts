import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../environments/environment";

@Injectable({
  providedIn: "root"
})
export class LogService {
  constructor(private _http: HttpClient) {}

  getErrors(accountId) {
    if (accountId > 0) {
      return this._http.get(environment.apiUrl + "/logs/errors/" + accountId);
    }

    return this._http.get(environment.apiUrl + "/logs/errors");
  }

  getEvents(accountId) {
    if (accountId > 0) {
      return this._http.get(environment.apiUrl + "/logs/events/" + accountId);
    }

    return this._http.get(environment.apiUrl + "/logs/events");
  }
}
