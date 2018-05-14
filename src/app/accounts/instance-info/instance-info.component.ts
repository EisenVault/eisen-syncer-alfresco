import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { AccountService } from "../../services/account.service";

@Component({
  selector: "app-instance-info",
  templateUrl: "./instance-info.component.html",
  styleUrls: ["./instance-info.component.scss"]
})
export class InstanceInfoComponent implements OnInit {
  public response;
  public errors = {};
  public instance_url = 'https://www.edms.cf';
  public username = 'admin@soubhik';
  public password = 'admin';
  public sync_path = '/var/www/html';
  public sync_on = true;
  public overwrite  = true;

  constructor(private _accountService: AccountService, private _router: Router) {}

  ngOnInit() {}

  addAccount() {
    this._accountService
      .addAccount({
        instance_url: this.instance_url,
        username: this.username,
        password: this.password,
        sync_path: this.sync_path,
        sync_on: this.sync_on,
        overwrite: this.overwrite
      })
      .subscribe(
        response => {
          if (response.status == 200) {
            this._router.navigate(["account-remote-folder", 200]);
          }
        },
        error => {
          if (error.status == 400) {
            for (let e of error.error.errors) {
              for (let errorField in e) {
                this.errors[errorField] = e[errorField];
              }
            }
          } else {
            throw error;
          }
        }
      );
  }
}
