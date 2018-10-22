import { Component, OnInit } from '@angular/core';
import { AccountService } from '../../services/account.service';
import { Router } from '@angular/router';
import { SyncerService } from '../../services/syncer.service';

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
  selector: 'app-manage',
  templateUrl: './manage.component.html',
  styleUrls: ['./manage.component.scss']
})
export class ManageComponent implements OnInit {
  public accounts;
  public isAppLoading = true;
  public isSaved = false;
  public showAccountLoaders: number[] = [];
  public errors: any = {};
  public miscError = '';

  constructor(
    private _accountService: AccountService,
    private _syncerService: SyncerService,
    private _router: Router
  ) { }

  ngOnInit() {
    // Start the process after a while
    setTimeout(() => {
      this._getAccounts();

      // When the app loads, lets try and sync the files from and to server.
      this._accountService
        .getAccounts('sync_enabled=1')
        .subscribe((accounts: IAccounts[]) => {
          for (const account of accounts) {
            // This is for the spinning loader icon
            const index = this.showAccountLoaders.indexOf(account.id);
            if (index === -1) {
              this.showAccountLoaders.push(account.id);
            }

            // Process sync
            this._processSync(account);

            console.log('Firing:', account.instance_url);
          } // End forloop
          this.isAppLoading = false;
        }, error => {
          console.log('error', error);
          this.isAppLoading = false;
          this.miscError = 'Cannot connect to the backend service.';
        });

      // For every x seconds, we will make a request to the account api and check
      // which accounts are still syncing, so that we can attach loaders for those accounts
      setInterval(() => {
        this._getAccounts();
      }, 10000);
    }, 2000);
  }

  _processSync(account) {
    // Fire the Delete, then Download then upload api...
    this._syncerService.syncDelete(account.id).subscribe(() => {
      const position = this.showAccountLoaders.indexOf(account.id);
      this.showAccountLoaders.splice(position, 1);

      this._syncerService.syncDownloads(account.id).subscribe(() => {
        this._syncerService.syncUploads(account.id).subscribe(() => {
          this._getAccounts();
        }); // End Upload subscribe
      }); // End Download subscribe
    }); // End Delete
  }

  isLoading(account) {
    return this.showAccountLoaders.indexOf(account.id) >= 0;
  }

  _getAccounts() {
    this._accountService.getAccounts().subscribe((accounts: IAccounts[]) => {
      this.accounts = accounts;
      for (const account of accounts) {
        // This is for the spinning loader icon
        const index = this.showAccountLoaders.indexOf(account.id);
        if (index === -1 && account.sync_in_progress === 1) {
          this.showAccountLoaders.push(account.id);
        } else if (account.sync_in_progress === 0) {
          this.showAccountLoaders.splice(index, 1);
        }
      } // End forloop
    });
  }

  update(e, account) {
    this._accountService.updateSync(account.id, e.target.checked).subscribe(
      () => {
        if (e.target.checked === true) {
          this._processSync(account);
        }

        this.isSaved = true;
        setTimeout(() => {
          this.isSaved = false;
        }, 3000);
      },
      error => {
        if (error.status === 400) {
          for (const errors of error.error.errors) {
            for (const errorField in errors) {
              if (errorField) {
                this.errors[errorField] = e[errorField];
              }
            }
          }
        } else {
          throw error;
        }

        e.target.checked = false;
        setTimeout(() => {
          this.errors = [];
        }, 3000);
      }
    );
  }

  goToManageAccount(account) {
    this._router.navigate(['account-new'], {
      queryParams: { accountId: account.id }
    });
  }

  deleteAccount(account) {
    if (confirm('Proceed with the account deletion process?')) {
      const answer = confirm(
        'Do you wish to remove the files from your local storage? (This will not delete the files from the server)'
      );
      this._accountService
        .deleteAccount(account.id, answer)
        .subscribe(() => this._getAccounts());
    }
  }
}
