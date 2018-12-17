import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AccountService } from '../../services/account.service';

@Component({
  selector: 'app-credentials',
  templateUrl: './credentials.component.html',
  styleUrls: ['./credentials.component.scss']
})
export class CredentialsComponent implements OnInit {

  public response;
  public loading = false;
  public errors: any = {};
  public accountId = 0;
  public instance_url = 'https://';
  public username = '';
  public password = '';
  public file = '';

  constructor(
    private _accountService: AccountService,
    private _router: Router,
    private _activatedRoute: ActivatedRoute
  ) { }

  ngOnInit() {
    this._activatedRoute.queryParams.subscribe(params => {
      this.accountId = params['accountId'];
      if (this.accountId) {
        this._accountService.getAccount(this.accountId).subscribe(response => {
          if (response) {
            this.instance_url = (<any>response).instance_url;
            this.username = (<any>response).username;
            this.password = (<any>response).password;
          }
        });
      }
    });
  }

  update() {
    this.loading = true;
    this.errors = {};
    this._accountService
      .updateCredentials({
        accountId: this.accountId,
        instance_url: this.instance_url,
        username: this.username,
        password: this.password,
      })
      .subscribe(
        response => {
          this.loading = false;
          if (response.status === 200) {
            this._router.navigate(
              ['account-details'],
              { queryParams: { accountId: (<any>response).body.account_id } });
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

  goBack() {
    this._router.navigate(['account-details'], {
      queryParams: { accountId: this.accountId }
    });
  }
}
