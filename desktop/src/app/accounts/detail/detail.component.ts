import { Component, OnInit } from '@angular/core';
import { AccountService } from '../../services/account.service';
import { SiteService } from '../../services/site.service';
import { SettingService } from '../../services/setting.service';
import { Router, ActivatedRoute } from '@angular/router';
import { Setting } from '../../models/setting';
import { WatchData } from '../../models/watcher';
import moment from 'moment-timezone';

interface Account {
  id: number;
  instance_url: string;
  sync_enabled: boolean;
  sync_frequency: number;
  sync_in_progress: boolean;
  sync_path: string;
  username: string;
  last_synced_at: number;
}

@Component({
  selector: 'app-detail',
  templateUrl: './detail.component.html',
  styleUrls: ['./detail.component.scss']
})
export class DetailComponent implements OnInit {

  public accountId: number;
  public account: Account;
  public departments = [];
  public departmentLoaded = false;
  public timezone: string;

  constructor(
    private _router: Router,
    private _route: ActivatedRoute,
    private _siteService: SiteService,
    private _settingService: SettingService,
    private _accountService: AccountService,
  ) { }

  ngOnInit() {
    this._route.queryParams.subscribe(param => {
      this.accountId = param['accountId'];
      this._accountService.getAccount(this.accountId).subscribe((account: Account) => {
        this.account = account;
      });

      // Get list of all watchlist
      this._siteService.getWatchers(this.accountId).subscribe((watchList: WatchData[]) => {
        const watchDepartments = [];
        watchList.map(item => {
          watchDepartments.push(item.site_id);
        });

        // Get list of all sites
        this._siteService.getSites(this.accountId).subscribe((sites: any) => {
          sites.list.entries.map((site: any) => {
            if (watchDepartments.indexOf(site.entry.guid) >= 0) {
              this.departments.push({ title: site.entry.title, role: site.entry.role });
            }
          });
          this.departmentLoaded = true;
        });
      });

    });

    // Get the timezone
    this._settingService
      .getSetting('TIMEZONE')
      .subscribe((result: Setting) => {
        this.timezone = moment(new Date()).tz(result.value).format('Z');
      });


  }

  onEdit(event, link) {
    event.preventDefault();

    this._accountService.getAccount(this.accountId).subscribe(
      account => {
        if (account.sync_enabled === true) {
          alert('You cannot edit an account when "Auto Sync" is turned on. ' +
            'Please turn off "Auto Sync" from the manage accounts page first.');
          return;
        } else {
          this._router.navigate([link], {
            queryParams: { accountId: this.accountId, edit: true }
          });
        }

      },
      error => {
        console.log(error);
      }
    );


  }

}
