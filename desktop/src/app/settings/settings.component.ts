import { Component, OnInit } from '@angular/core';
import { SettingService } from '../services/setting.service';
import { ElectronService } from 'ngx-electron';

interface Setting {
  id: number;
  name: string;
  value: any;
}

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {
  public startup_launch;
  public sync_interval = 10; // minutes
  public api_interval = 5; // seconds
  public timezone = 'Asia/Calcutta';
  public isSaved = false;

  constructor(
    private _settingService: SettingService,
    private _electronService: ElectronService
  ) { }

  ngOnInit() {
    this.startup_launch = false;
    this._settingService.getSetting('SYNC_INTERVAL').subscribe((result: Setting) => {
      this.sync_interval = Number(result.value);
    });

    this._settingService.getSetting('LAUNCH_AT_STARTUP').subscribe((result: Setting) => {
      this.startup_launch = Number(result.value);
    });

    this._settingService.getSetting('TIMEZONE').subscribe((result: Setting) => {
      this.timezone = result.value;
    });

    this._settingService.getSetting('SYNC_PAUSE_SECONDS').subscribe((result: Setting) => {
      this.api_interval = Number(result.value);
    });
  }

  saveSettings() {
    const value = this.startup_launch === true ? 1 : 0;

    // Launch at startup
    this._settingService.updateSetting('LAUNCH_AT_STARTUP', value).subscribe(() => { });

    // Timezone
    this._settingService.updateSetting('TIMEZONE', this.timezone).subscribe(() => {
      localStorage.removeItem('timezone');
    });

    // API Interval
    this._settingService.updateSetting('SYNC_PAUSE_SECONDS', this.api_interval).subscribe(() => { });

    // Sync Interval
    this._settingService.updateSetting('SYNC_INTERVAL', this.sync_interval).subscribe(() => { });
    if (this._electronService.isElectronApp) {
      this._electronService.ipcRenderer.sendSync(
        'autolaunch',
        value
      );
      this.isSaved = true;
      setTimeout(() => {
        this.isSaved = false;
      }, 3000);
    }
  }
}
