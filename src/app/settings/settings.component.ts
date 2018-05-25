import { Component, OnInit } from "@angular/core";
import { SettingService } from "../services/setting.service";

@Component({
  selector: "app-settings",
  templateUrl: "./settings.component.html",
  styleUrls: ["./settings.component.scss"]
})
export class SettingsComponent implements OnInit {
  public startup_launch: boolean = true;
  public settings: object;
  constructor(private _settingService: SettingService) {}

  ngOnInit() {
    return this._settingService.getSettings().subscribe(settings => {
      this.settings = settings;
    });
  }

  saveSettings() {
    this._settingService
      .updateSettings("startup_launch", this.startup_launch)
      .subscribe(response => {
        console.log(response);
      });
  }
}
