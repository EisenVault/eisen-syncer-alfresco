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
  public loading: boolean = false;
  public errors: any = {};
  public accountId: number = 0;
  public instance_url: string = "";
  public username: string = "";
  public password: string = "";
  public sync_path: string = "...";
  public sync_frequency: number = 2;
  public sync_enabled: boolean = true;
  public overwrite: boolean = false;
  public file: string = "";

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
            this.sync_enabled = (<any>response).sync_enabled;
            this.sync_path = (<any>response).sync_path;
            this.sync_frequency = (<any>response).sync_frequency;
            this.overwrite = (<any>response).overwrite;
          }
        });
      }
    });
  }

  addAccount() {
    // Update the account if it already exists
    if (this.accountId > 0) {
      return this.updateAccount();
    }

    this.loading = true;
    this.errors = {};
    this._accountService
      .addAccount({
        instance_url: this.instance_url,
        username: this.username,
        password: this.password,
        sync_path: this.sync_path,
        sync_frequency: this.sync_frequency,
        sync_enabled: this.sync_enabled,
        overwrite: this.overwrite
      })
      .subscribe(
        response => {
          this.loading = false;
          if (response.status == 201) {
            this._router.navigate([
              "account-remote-folder",
              (<any>response).body.account_id
            ]);
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

  updateAccount() {
    this.loading = true;
    this.errors = {};
    this._accountService
      .updateAccount({
        accountId: this.accountId,
        instance_url: this.instance_url,
        username: this.username,
        password: this.password,
        sync_path: this.sync_path,
        sync_frequency: this.sync_frequency,
        sync_enabled: this.sync_enabled,
        overwrite: this.overwrite
      })
      .subscribe(
        response => {
          this.loading = false;
          if (response.status == 200) {
            this._router.navigate([
              "account-remote-folder",
              (<any>response).body.account_id
            ]);
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
