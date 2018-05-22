import { Injectable } from '@angular/core';
import { HttpClient } from "@angular/common/http";
import { environment } from "../../environments/environment";

@Injectable({
  providedIn: 'root'
})
export class NodeService {

  constructor(private _http: HttpClient) {}

  getNodes(accountId, nodeId) {
    return this._http.get(environment.apiUrl + "/nodes/" + accountId + '/' + nodeId);
  }
}
