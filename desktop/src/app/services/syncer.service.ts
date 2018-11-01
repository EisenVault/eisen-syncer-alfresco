import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../environments/environment";

@Injectable({
  providedIn: "root"
})
export class SyncerService {
  constructor(private _httpClient: HttpClient) {}

  start(accountId: number) {
    // Fire Download then upload api...
    this.syncDownloads(accountId).subscribe(() => {
      this.syncUploads(accountId).subscribe(() => {
        return true;
      }); // End Upload subscribe
    }); // End Download subscribe
  }

  syncDownloads(accountId: number) {
    return this._httpClient.get(
      environment.apiUrl + "/syncer/downloads/" + accountId
    );
  }

  syncUploads(accountId: number) {
    return this._httpClient.post(environment.apiUrl + "/syncer/uploads", {
      account_id: accountId
    });
  }

  syncDelete(accountId: number) {
    return this._httpClient.delete(environment.apiUrl + "/syncer/" + accountId);
  }
}
