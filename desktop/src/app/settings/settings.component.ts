import { Component, OnInit } from '@angular/core';
import { SettingService } from '../services/setting.service';
import { ElectronService } from 'ngx-electron';

interface Setting {
  id: number;
  name: string;
  value: number;
}

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {
  public startup_launch;
  public sync_interval = 10;
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
  }

  saveSettings() {
    const value = this.startup_launch === true ? 1 : 0;
    this._settingService.updateSetting('LAUNCH_AT_STARTUP', value).subscribe(() => { });
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
