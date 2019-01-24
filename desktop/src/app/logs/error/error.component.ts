import { Component, OnInit } from '@angular/core';
import { LogService } from '../../services/log.service';
import { ActivatedRoute } from '@angular/router';
import { SettingService } from '../../services/setting.service';
import moment from 'moment-timezone';
import { Setting } from '../../models/setting';

@Component({
  selector: 'app-error',
  templateUrl: './error.component.html',
  styleUrls: ['./error.component.scss']
})
export class ErrorComponent implements OnInit {
  public logs;
  public timezone = 'Asia/Calcutta';
  public isLoading = true;

  constructor(
    private _logService: LogService,
    private _activatedRoute: ActivatedRoute,
    private _settingService: SettingService,
  ) { }

  ngOnInit() {
    // Get the timezone
    this._settingService
      .getSetting('TIMEZONE')
      .subscribe((result: Setting) => {
        this.timezone = moment(new Date()).tz(result.value).format('Z');
      });

    this._activatedRoute.queryParams.subscribe(params => {
      const accountId = params['accountId'] || 0;
      this._logService
        .getErrors(accountId)
        .subscribe(response => {
          this.isLoading = false;
          this.logs = response;
        });
    });
  }
}
