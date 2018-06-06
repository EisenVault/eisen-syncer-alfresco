import { Component, OnInit } from "@angular/core";
import { AccountService } from "../../services/account.service";
import { Router } from "@angular/router";
import { THROW_IF_NOT_FOUND } from "@angular/core/src/di/injector";
import { SyncerService } from "../../services/syncer.service";

@Component({
  selector: "app-manage",
  templateUrl: "./manage.component.html",
  styleUrls: ["./manage.component.scss"]
})
export class ManageComponent implements OnInit {
  public accounts;
  public isSaved: boolean = false;
  public showAccountLoaders: number[] = [];
  constructor(
    private _accountService: AccountService,
    private _syncerService: SyncerService,
    private _router: Router
  ) {}

  ngOnInit() {
    // Load all accounts
    this._getAccounts();

    // Refresh the account data every 10 seconds to see if any sync is still in progress
    setInterval(() => {
      this._accountService.getAccounts().subscribe(accounts => {
        this.accounts = accounts;

        for (let account of this.accounts) {
          let lastSyncInMinutes = this.differenceInMinutes(
            account.last_synced_at
          );
          console.log("lastSyncInMinutes", lastSyncInMinutes);

          if (
            account.sync_enabled == 1 &&
            account.sync_in_progress == 0 &&
            lastSyncInMinutes >= account.sync_frequency
          ) {
            let index = this.showAccountLoaders.indexOf(account.id);
            if (index == -1) {
              this.showAccountLoaders.push(account.id);
            }
            console.log("loop", account.id, this.showAccountLoaders);

            // Fire the upload and then the download api...
            this._syncerService
              .syncDownloads(account.id)
              .subscribe(response => {
                console.log("rseponse after download complete", response);

                let index = this.showAccountLoaders.indexOf(account.id);
                this.showAccountLoaders.splice(index, 1);

                // this._syncerService
                //   .syncUploads(account.id, account.overwrite)
                //   .subscribe(response => {
                //     this._getAccounts();
                //     this.showLoader = false;
                //   });
              }); // End download subscribe

            console.log("Firing:", account.instance_url);
          }
        } // End forloop
      });
    }, 10000);
  }

  isLoading(account) {
    // console.log( this.showAccountLoaders );

    // console.log( this.showAccountLoaders.indexOf(account.id) >= 0 );

    return this.showAccountLoaders.indexOf(account.id) >= 0;
  }

  _getAccounts() {
    this._accountService
      .getAccounts()
      .subscribe(accounts => (this.accounts = accounts));
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
    this._router.navigate(["account-new"], {
      queryParams: { accountId: accountId }
    });
  }

  deleteAccount(accountId) {
    if (
      confirm(
        "This will delete the selected account but will not delete the folder or its contents. Continue?"
      )
    ) {
      this._accountService
        .deleteAccount(accountId)
        .subscribe(response => this._getAccounts());
    }
  }

  differenceInMinutes(time) {
    let now = Date.now();
    return Math.round((now - time) / 1000 / 60);
  }
}
