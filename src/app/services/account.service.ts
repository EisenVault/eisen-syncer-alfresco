import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../environments/environment";

interface account {
  status: Number
}

@Injectable({
  providedIn: "root"
})
export class AccountService {
  constructor(private _http: HttpClient) {}

  addAccount(params) {
    return this._http.post<account>(
      environment.apiUrl + "/accounts",
      {
        instance_url: params.instance_url,
        username: params.username,
        password: params.password,
        sync_path: params.sync_path,
        sync_on: params.sync_on,
        overwrite: params.overwrite
      },
      {
        observe: "response" as "body", // to display the full response & as 'body' for type cast
        responseType: "json"
      }
    );
  }
}
