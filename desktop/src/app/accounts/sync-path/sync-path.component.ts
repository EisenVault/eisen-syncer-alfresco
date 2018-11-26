import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AccountService } from '../../services/account.service';

@Component({
  selector: 'app-sync-path',
  templateUrl: './sync-path.component.html',
  styleUrls: ['./sync-path.component.scss']
})
export class SyncPathComponent implements OnInit {
  public response;
  public loading = false;
  public errors: any = {};
  public accountId = 0;
  public sync_path = '';
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
            this.sync_path = (<any>response).sync_path;
          }
        });
      }
    });
  }

  update() {
    this.loading = true;
    this.errors = {};
    this._accountService
      .updateSyncPath({
        accountId: this.accountId,
        sync_path: this.sync_path,
      })
      .subscribe(
        response => {
          this.loading = false;
          if (response.status === 200) {
            this._router.navigate(
              ['account-details'],
              { queryParams: { accountId: (<any>response).body.account_id }}
            );
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
    const file = <HTMLScriptElement>document.getElementById('file');
    file.click();

    file.addEventListener(
      'change',
      () =>
        (this.sync_path = (document.getElementById(
          'file'
        ) as any).files[0].path),
      false
    );
  }
}
