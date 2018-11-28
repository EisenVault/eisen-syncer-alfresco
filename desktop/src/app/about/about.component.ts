import { Component, OnInit } from '@angular/core';
import { SettingService } from '../services/setting.service';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss']
})
export class AboutComponent implements OnInit {

  public about;
  constructor(
    private _settingService: SettingService
  ) { }

  ngOnInit() {
    this._settingService.getSetting('about').subscribe(
      result => {
        this.about = result;
      },
      error => console.log(error)
    );
  }

}
