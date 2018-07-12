import { Component, OnInit } from "@angular/core";
import { AccountService } from "../../services/account.service";
import { Router } from "@angular/router";
import { SyncerService } from "../../services/syncer.service";
import { ElectronService } from "ngx-electron";

interface IAccounts {
  id: number;
  instance_url: string;
  username: string;
  watch_node: string;
  sync_path: string;
  sync_enabled: number;
  sync_frequency: number;
  sync_in_progress: number;
  last_synced_at: number;
}

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
    private _electronService: ElectronService,
    private _router: Router
  ) {}

  ngOnInit() {
    // Load all accounts
    this._getAccounts();

    // When the app loads, lets try and sync the files from and to server.
    this._accountService
      .getAccounts("sync_enabled=1")
      .subscribe((accounts: IAccounts[]) => {
        this.accounts = accounts;

        for (let account of this.accounts) {
          // This is for the spinning loader icon
          let index = this.showAccountLoaders.indexOf(account.id);
          if (index == -1) {
            this.showAccountLoaders.push(account.id);
          }

          // Fire the Delete, then Download then upload api...
          this._syncerService.syncDelete(account.id).subscribe(response => {
            let index = this.showAccountLoaders.indexOf(account.id);
            this.showAccountLoaders.splice(index, 1);

            this._syncerService
              .syncDownloads(account.id)
              .subscribe(response => {
                this._syncerService
                  .syncUploads(account.id)
                  .subscribe(response => {
                    this._getAccounts();
                  }); // End Upload subscribe
              }); // End Download subscribe
          }); // End Delete

          console.log("Firing:", account.instance_url);
        } // End forloop
      });

    // For every x seconds, we will make a request to the account api and check which accounts are still syncing, so that we can attach loaders for those accounts
    setInterval(() => {
      console.log("setInterval...");

      this._accountService.getAccounts().subscribe((accounts: IAccounts[]) => {
        for (let account of accounts) {
          console.log("account.sync_in_progress", account.sync_in_progress);

          // This is for the spinning loader icon
          let index = this.showAccountLoaders.indexOf(account.id);
          if (index == -1 && account.sync_in_progress == 1) {
            this.showAccountLoaders.push(account.id);
          } else if (account.sync_in_progress == 0) {
            this.showAccountLoaders.splice(index, 1);
          }
        } // End forloop
      });
    }, 10000);
  }

  isLoading(account) {
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
}