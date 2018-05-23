import { Injectable } from "@angular/core";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { environment } from "../../environments/environment";
import { WatchNode } from "../models/watch-node";

@Injectable({
  providedIn: "root"
})
export class WatchNodeService {
  constructor(private _http: HttpClient) {}

  addWatchNodes(accountId, nodes) {

    const httpOptions = {
      headers: new HttpHeaders({
        'Content-Type':  'application/json'
      })
    };

    return this._http.post<WatchNode>(
      environment.apiUrl + "/watch-nodes",
      {
        account_id: accountId,
        nodes: nodes
      },
      httpOptions
    );
  }
}
