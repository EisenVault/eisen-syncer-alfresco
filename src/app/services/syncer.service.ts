import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../environments/environment";

@Injectable({
  providedIn: "root"
})
export class SyncerService {
  constructor(private _httpClient: HttpClient) {}

  syncDownloads(accountId: number) {
    return this._httpClient.get(
      environment.apiUrl + "/syncer/downloads/" + accountId
    );
  }

  syncUploads(accountId: number, overwrite: boolean) {
    return this._httpClient.post(environment.apiUrl + "/syncer/uploads", {
      account_id: accountId,
      overwrite: overwrite
    });
  }
}
