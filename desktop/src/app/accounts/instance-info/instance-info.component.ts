import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { AccountService } from "../../services/account.service";

@Component({
  selector: "app-instance-info",
  templateUrl: "./instance-info.component.html",
  styleUrls: ["./instance-info.component.scss"]
})
export class InstanceInfoComponent implements OnInit {
  public response;
  public loading = false;
  public errors: any = {};
  public accountId = 0;
  public instance_url = "https://";
  public username = "";
  public password = "";
  public sync_path = "";
  public sync_frequency = 2;
  public sync_enabled = false;
  public file = "";

  constructor(
    private _accountService: AccountService,
    private _router: Router,
    private _activatedRoute: ActivatedRoute
  ) {}

  ngOnInit() {
    this._activatedRoute.queryParams.subscribe(params => {
      this.accountId = params["accountId"];
      if (this.accountId) {
        this._accountService.getAccount(this.accountId).subscribe(response => {
          if (response) {
            this.instance_url = (<any>response).instance_url;
            this.username = (<any>response).username;
            this.password = (<any>response).password;
            this.sync_enabled = false;
            this.sync_path = (<any>response).sync_path;
            this.sync_frequency = (<any>response).sync_frequency;
          }
        });
      }
    });
  }

  addAccount() {
    this.loading = true;
    this.errors = {};
    this._accountService
      .addAccount({
        account_id: this.accountId || 0,
        instance_url: this.instance_url,
        username: this.username,
        password: this.password,
        sync_path: this.sync_path,
        sync_frequency: this.sync_frequency,
        sync_enabled: this.sync_enabled
      })
      .subscribe(
        response => {
          this.loading = false;
          if (response.status === 201) {
            this._router.navigate([
              "account-remote-folder",
              (<any>response).body.id
            ]);
          }
        },
        error => {
          this.loading = false;
          if (error.status === 400) {
            for (const e of error.error.errors) {
              for (const errorField in e) {
                if (e[errorField]) {
                  this.errors[errorField] = e[errorField];
                }
              }
            }
          } else {
            throw error;
          }
        }
      );
  }

  onBrowse() {
    const file = <HTMLScriptElement>document.getElementById("file");
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
