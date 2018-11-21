import { Component, OnInit } from '@angular/core';
import { AccountService } from '../../services/account.service';
import { SiteService } from '../../services/site.service';
import { SettingService } from '../../services/setting.service';
import { ActivatedRoute } from '@angular/router';
import { Setting } from '../../models/setting';
import { WatchData } from '../../models/watcher';
import moment from 'moment-timezone';

interface Account {
  id: number;
  instance_url: string;
  sync_enabled: number;
  sync_frequency: number;
  sync_in_progress: number;
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

  public account: Account;
  public departments = [];
  public timezone: string;

  constructor(
    private _route: ActivatedRoute,
    private _siteService: SiteService,
    private _settingService: SettingService,
    private _accountService: AccountService,
  ) { }

  ngOnInit() {
    this._route.queryParams.subscribe(param => {
      const accountId = param['accountId'];
      this._accountService.getAccount(accountId).subscribe((account: Account) => {
        this.account = account;
      });

      // Get list of all watchlist
      this._siteService.getWatchers(accountId).subscribe((watchList: WatchData[]) => {
        const watchDepartments = [];
        watchList.map(item => {
          watchDepartments.push(item.site_id);
        });

        // Get list of all sites
        this._siteService.getSites(accountId).subscribe((sites: any) => {
          sites.list.entries.map((site: any) => {
            if (watchDepartments.indexOf(site.entry.guid) >= 0) {
              this.departments.push({ title: site.entry.title, role: site.entry.role });
            }
          });

          console.log('this.departments', this.departments);


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

}
