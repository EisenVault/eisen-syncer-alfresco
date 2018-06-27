import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../environments/environment";

@Injectable({
  providedIn: "root"
})
export class ParentNodeService {
  constructor(private _http: HttpClient) {}

  getParents(accountId, nodeId) {
    return this._http.get(environment.apiUrl + "/nodes/parents/" + accountId + '/' + nodeId);
  }
}
