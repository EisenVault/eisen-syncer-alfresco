import { Component, OnInit } from '@angular/core';
import { LogService } from '../../services/log.service';
import { ActivatedRoute } from '@angular/router';
import { SettingService } from '../../services/setting.service';
import moment from 'moment-timezone';
import { Setting } from '../../models/setting';

@Component({
  selector: 'app-event',
  templateUrl: './event.component.html',
  styleUrls: ['./event.component.scss']
})
export class EventComponent implements OnInit {
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
        .getEvents(accountId)
        .subscribe(response => {
          this.isLoading = false;
          this.logs = response;
        });
    });
  }

  getBadgeClass($type) {
    switch ($type) {
      case 'UPLOAD_FOLDER':
        return 'badge badge-primary';
      case 'UPLOAD_FILE':
        return 'badge badge-secondary';
      case 'DOWNLOAD_FILE':
        return 'badge badge-info';
      case 'DELETE_FILE':
      case 'DELETE_FOLDER':
      case 'DELETE_NODE':
        return 'badge badge-danger';
      default:
        return 'badge badge-warning';
    }
  }
}
