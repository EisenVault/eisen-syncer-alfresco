import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../environments/environment";

@Injectable({
  providedIn: "root"
})
export class SyncerService {
  constructor(private _httpClient: HttpClient) { }

  start(accountId: number) {

    // Fire the Delete, then Download then upload api...
    return this.syncDelete(accountId).subscribe(response => {

      this.syncDownloads(accountId)
        .subscribe(() => {
          this.syncUploads(accountId)
            .subscribe(() => {
              return true;
            }); // End Upload subscribe
        }); // End Download subscribe
    }); // End Delete

  }

  syncDelete(accountId: number) {
    return this._httpClient.delete(environment.apiUrl + "/syncer/" + accountId);
  }

  syncDownloads(accountId: number) {
    return this._httpClient.get(
      environment.apiUrl + "/syncer/downloads/" + accountId
    );
  }

  syncUploads(accountId: number) {
    return this._httpClient.post(environment.apiUrl + "/syncer/uploads", {
      account_id: accountId,
    });
  }
}
