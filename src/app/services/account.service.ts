import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../environments/environment";
import { Account } from "../models/account";

@Injectable({
  providedIn: "root"
})
export class AccountService {
  constructor(private _http: HttpClient) {}

  getAccounts(querystring = "") {
    return this._http.get(environment.apiUrl + "/accounts?" + querystring);
  }

  getAccount(accountId) {
    return this._http.get(environment.apiUrl + "/accounts/" + accountId);
  }

  addAccount(params) {
    return this._http.post<Account>(
      environment.apiUrl + "/accounts",
      {
        instance_url: params.instance_url,
        username: params.username,
        password: params.password,
        sync_path: params.sync_path,
        sync_frequency: params.sync_frequency,
        sync_enabled: params.sync_enabled,
        overwrite: params.overwrite
      },
      {
        observe: "response" as "body", // to display the full response & as 'body' for type cast
        responseType: "json"
      }
    );
  }

  updateAccount(params) {
    return this._http.put<Account>(
      environment.apiUrl + "/accounts/" + params.accountId,
      {
        instance_url: params.instance_url,
        username: params.username,
        password: params.password,
        sync_path: params.sync_path,
        sync_frequency: params.sync_frequency,
        sync_enabled: params.sync_enabled,
        overwrite: params.overwrite
      },
      {
        observe: "response" as "body", // to display the full response & as 'body' for type cast
        responseType: "json"
      }
    );
  }

  updateWatchNode(accountId, nodeId) {
    return this._http.put(
      environment.apiUrl + "/accounts/" + accountId + "/watchnode",
      {
        watch_node: nodeId
      }
    );
  }


  updateSync(accountId, sync) {
    return this._http.put(
      environment.apiUrl + "/accounts/" + accountId + "/sync",
      {
        sync_enabled: sync
      }
    );
  }

  deleteAccount(accountId) {
    return this._http.delete(environment.apiUrl + "/accounts/" + accountId);
  }
}
