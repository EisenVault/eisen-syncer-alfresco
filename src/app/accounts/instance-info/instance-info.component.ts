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
  private loading: boolean = false;
  public errors: any = {};
  public instance_url: string = "https://www.edms.cf";
  public username: string = "admin@soubhik";
  public password: string = "admin";
  public sync_path: string = "/var/www/html";
  public sync_on: boolean = true;
  public overwrite: boolean = true;
  public file: string = "";

  constructor(
    private _accountService: AccountService,
    private _router: Router
  ) {}

  ngOnInit() {}

  addAccount() {
    this.loading = true;
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
          this.loading = false;
          if (response.status == 201) {
            this._router.navigate(["account-remote-folder", (<any>response).body.account_id]);
          }
        },
        error => {
          this.loading = false;
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

  onBrowse() {
    let file = <HTMLScriptElement>document.getElementById("file");
    file.click();

    file.addEventListener(
      "change",
      () =>
        (this.sync_path = (document.getElementById(
          "file"
        ) as any).files[0].path),
      false
    );
  }
}
