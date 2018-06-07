import { Component, OnInit } from "@angular/core";
import { SettingService } from "../services/setting.service";
import { ElectronService } from "ngx-electron";

interface Setting {
  id: number;
  name: string;
  value: number;
}

@Component({
  selector: "app-settings",
  templateUrl: "./settings.component.html",
  styleUrls: ["./settings.component.scss"]
})
export class SettingsComponent implements OnInit {
  public startup_launch;
  constructor(
    private _settingService: SettingService,
    private _electronService: ElectronService
  ) {}

  ngOnInit() {
    this.startup_launch = false;

    this._settingService.getSettings().subscribe((result: Setting) => {
      this.startup_launch = Number(result.value);
    });
  }

  saveSettings() {
    let value = this.startup_launch === true ? 1 : 0;
    this._settingService.startupSettings(value).subscribe(response => {});

    if (this._electronService.isElectronApp) {
      let reply: string = this._electronService.ipcRenderer.sendSync(
        "autolaunch",
        value
      );
      console.log(reply);
    }
  }
}
