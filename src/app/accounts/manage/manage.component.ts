import { Component, OnInit } from "@angular/core";
import { AccountService } from "../../services/account.service";
import { Router } from "@angular/router";
import { THROW_IF_NOT_FOUND } from "@angular/core/src/di/injector";

@Component({
  selector: "app-manage",
  templateUrl: "./manage.component.html",
  styleUrls: ["./manage.component.scss"]
})
export class ManageComponent implements OnInit {
  public accounts: object;
  public isSaved: boolean = false;
  constructor(
    private _accountService: AccountService,
    private _router: Router
  ) {}

  ngOnInit() {
    this._accountService
      .getAccounts()
      .subscribe(accounts => (this.accounts = accounts));

    // Refresh the account data every 10 seconds to see if any sync is still in progress
    setInterval(() => {
      this._accountService.getAccounts().subscribe(accounts => {
        this.accounts = accounts;

        for (let account of accounts) {
          let lastSyncInMinutes = this.differenceInMinutes(
            account.last_synced_at
          );
          console.log("lastSyncInMinutes", lastSyncInMinutes);
          console.log("account.sync_frequency", account.sync_frequency);
          console.log("account.sync_enabled ", account.sync_enabled);

          if (
            account.sync_enabled == 1 &&
            lastSyncInMinutes < account.sync_frequency
          ) {

            // Fire the upload and then the download api...
          }
        }
      });
    }, 10000);
  }

  update(e, accountId) {
    this._accountService
      .updateSync(accountId, e.target.checked)
      .subscribe(response => {
        this.isSaved = true;
        setTimeout(() => {
          this.isSaved = false;
        }, 3000);
      });
  }

  goToManageAccount(accountId) {
    this._router.navigate([""], { queryParams: { accountId: accountId } });
  }

  isSynced(time) {
    let now = Date.now();
    let difference = Math.round((now - time) / 60);

    // If the last sync date/time was more than 30 seconds then assume the syncing was completed.
    if (difference > 30) {
      return true;
    }

    return false;
  }

  differenceInMinutes(time) {
    let now = Date.now();
    return Math.round((now - time) / 1000 / 60);
  }
}
