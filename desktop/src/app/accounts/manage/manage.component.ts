import { Component, OnInit } from '@angular/core';
import { AccountService } from '../../services/account.service';
import { Router } from '@angular/router';
import { SyncerService } from '../../services/syncer.service';
import { SettingService } from '../../services/setting.service';
import { Setting } from '../../models/setting';
import { ElectronService } from 'ngx-electron';

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
  private enabledSyncAccounts: number[] = [];
  public errors: any = {};
  public miscError = '';
  readonly INTERVAL = 7000;
  private syncIntervalSetting = 10;

  constructor(
    private _accountService: AccountService,
    private _syncerService: SyncerService,
    private _settingService: SettingService,
    private _router: Router,
    private _electronService: ElectronService
  ) { }

  ngOnInit() {
    setTimeout(() => {
      this._getAccounts();

      // Get the sync interval
      this._settingService
        .getSetting('SYNC_INTERVAL')
        .subscribe((result: Setting) => {
          this.syncIntervalSetting = Number(result.value) * 60;
          // For every minute, we will run the timer for sync...
          setInterval(() => {
            this._runSyncEnabledAccounts();
          }, 60000);
        });

      // Get the launch status
      this._settingService
        .getSetting('LAUNCH_AT_STARTUP')
        .subscribe((result: Setting) => {
          // If the launch status is -1 (means user ran the app for the first time), we will enable it
          if (result.value === '-1') {
            if (this._electronService.isElectronApp) {
              this._electronService.ipcRenderer.sendSync('autolaunch', 1);
            }
          }
        });

      // When the app loads, lets try and sync the files from and to server.
      this._runSyncEnabledAccounts();
    }, 5000);

    // For every x seconds, we will make a request to the account api and check
    // which accounts are still syncing, so that we can attach loaders for those accounts
    setInterval(() => {
      this._getAccounts();
    }, this.INTERVAL);
  }

  _runSyncEnabledAccounts() {
    this._accountService.getAccounts('sync_enabled=1').subscribe(
      (accounts: IAccounts[]) => {
        for (const account of accounts) {
          // Process sync
          this._processSync(account);
        } // End forloop
      },
      error => {
        console.log('error', error);
      }
    );
  }

  _processSync(account) {
    // Stop the loading icon by default. Start when before running the sync api
    const position = this.showAccountLoaders.indexOf(account.id);
    this.showAccountLoaders.splice(position, 1);
    const currentTimestamp = Math.round(new Date().getTime() / 1000);
    const timeDifference = Math.abs(currentTimestamp - account.last_synced_at);

    // Proceed with sync only if its not currently in progress and if the last sync time is greater-equal than the time assigned in settings
    if (account.sync_in_progress === '0' && timeDifference >= this.syncIntervalSetting) {
      // This is for the spinning loader icon
      const index = this.showAccountLoaders.indexOf(account.id);
      if (index === -1) {
        this.showAccountLoaders.push(account.id);
      }
      // Fire the syncer endpoint...
      this._syncerService.start(account.id);
    }
  }

  isLoading(account) {
    const accountLastSync = account.last_synced_at
      ? account.last_synced_at
      : new Date().getTime();
    const index = this.enabledSyncAccounts.indexOf(account.id);

    return (
      (index !== -1 &&
        Math.round((new Date().getTime() - accountLastSync) / 1000) <= 15) ||
      this.showAccountLoaders.indexOf(account.id) >= 0
    );
  }

  _getAccounts() {
    this._accountService.getAccounts().subscribe(
      (accounts: IAccounts[]) => {
        this.accounts = accounts;
        this.miscError = '';
        this.isAppLoading = false;
        for (const account of accounts) {
          // This is for the spinning loader icon
          const index = this.showAccountLoaders.indexOf(account.id);
          if (index === -1 && account.sync_in_progress === 1) {
            this.showAccountLoaders.push(account.id);
          } else if (account.sync_in_progress === 0) {
            this.showAccountLoaders.splice(index, 1);
          }
        } // End forloop
      },
      error => {
        this.isAppLoading = false;
        this.miscError = 'Cannot connect to the backend service.';
      }
    );
  }

  update(e, account) {
    this._accountService.updateSync(account.id, e.target.checked).subscribe(
      () => {
        if (e.target.checked === true) {
          this._processSync(account);
          this.enabledSyncAccounts.push(account.id);
        } else {
          const index = this.enabledSyncAccounts.indexOf(account.id);
          this.enabledSyncAccounts.slice(index, 1);
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
