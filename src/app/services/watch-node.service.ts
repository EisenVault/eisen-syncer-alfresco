import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../environments/environment";

@Injectable({
  providedIn: "root"
})
export class WatchNodeService {
  constructor(private _http: HttpClient) {}

  addWatchNodes(accountId, nodes) {
    return this._http.post(environment.apiUrl + "/watch-nodes", {
      account_id: accountId,
      nodes: nodes
    });
  }
}
