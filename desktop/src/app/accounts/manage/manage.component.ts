import { Component, OnInit } from '@angular/core';
import { AccountService } from '../../services/account.service';
import { Router, ActivatedRoute } from '@angular/router';
import { SyncerService } from '../../services/syncer.service';
import { SettingService } from '../../services/setting.service';
import { Setting } from '../../models/setting';
import { ElectronService } from 'ngx-electron';
import moment from 'moment-timezone';

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
  private enabledSyncAccounts: number[] = [];
  public errors: any = {};
  public miscError = '';
  readonly INTERVAL = 7000;
  private syncIntervalSetting = 10;
  public timezone = 'Asia/Calcutta';

  constructor(
    private _accountService: AccountService,
    private _syncerService: SyncerService,
    private _settingService: SettingService,
    private _router: Router,
    private route: ActivatedRoute,
    private _electronService: ElectronService
  ) { }

  ngOnInit() {
    // If the app has already loaded then no need for the 5 seconds wait time
    this.route.queryParams.subscribe(params => {
      if (params['cached'] === '1') {
        this._getAccounts();
        this.isAppLoading = false;
      }
    });

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

      // Get the timezone
      this._settingService
        .getSetting('TIMEZONE')
        .subscribe((result: Setting) => {
          this.timezone = moment(new Date()).tz(result.value).format('Z');
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

  _processSync(account, forceSync = false) {
    // Stop the loading icon by default. Start when before running the sync api
    const currentTimestamp = Math.round(new Date().getTime());
    const timeDifference = Math.abs((currentTimestamp - account.last_synced_at) / 1000); // in seconds

    console.log('bool', (account.sync_in_progress === false && timeDifference >= this.syncIntervalSetting), timeDifference,  this.syncIntervalSetting);

    // Proceed with sync only if its not currently in progress and if the last sync time is greater-equal than the time assigned in settings
    if (
      forceSync === true || (account.sync_in_progress === false && timeDifference >= this.syncIntervalSetting)
    ) {
      this.enabledSyncAccounts.push(account.id);
      // Fire the syncer endpoint...
      console.log('started sync for account', account.id);

      this._syncerService.start(account.id);
    }
  }

  isLoading(account) {
    // const accountLastSync = account.last_synced_at
    //   ? account.last_synced_at
    //   : new Date().getTime();
    const index = this.enabledSyncAccounts.indexOf(account.id);

    // Determine if the account is in loading status
    const isLoading = index !== -1 ||
      account.sync_in_progress === true ||
      account.download_in_progress === true ||
      account.upload_in_progress === true;

    if (this._electronService.isElectronApp) {
      this._electronService.ipcRenderer.send('isSyncing', isLoading);
    }

    return isLoading;
  }

  _getAccounts() {
    this.isAppLoading = true;
    this._accountService.getAccounts().subscribe(
      (accounts: IAccounts[]) => {
        this.accounts = accounts;
        this.miscError = '';
        this.isAppLoading = false;
      },
      () => {
        this.isAppLoading = false;
        this.miscError = 'Cannot connect to the backend service.';
      }
    );
  }

  update(e, account) {
    this._accountService.updateSync(account.id, e.target.checked).subscribe(
      () => {
        if (e.target.checked === true) {
          this.enabledSyncAccounts.push(account.id);
          this._processSync(account, true);
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

        // e.target.checked = false;
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

  goToAccountDetails(account) {
    this._router.navigate(['account-details'], {
      queryParams: { accountId: account.id }
    });
  }

  deleteAccount(account) {
    if (confirm('Proceed with the account deletion process?')) {
      const answer = confirm(
        `Account was deleted successfully!\n\nWould you like to DELETE the contents of the folder '${account.sync_path}' from your local path? This data will however NOT get deleted from the server.`
      );
      this._accountService
        .deleteAccount(account.id, answer)
        .subscribe(() => this._getAccounts());
    }
  }
}
