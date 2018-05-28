import { Component, OnInit } from "@angular/core";
import { AccountService } from "../../services/account.service";
import { Router } from "@angular/router";

@Component({
  selector: "app-manage",
  templateUrl: "./manage.component.html",
  styleUrls: ["./manage.component.scss"]
})
export class ManageComponent implements OnInit {
  public accounts: object;
  public isSaved: boolean = false;
  constructor(
    private _accountService: AccountService,
    private _router: Router
  ) {}

  ngOnInit() {
    this._accountService
      .getAccounts()
      .subscribe(accounts => (this.accounts = accounts));

    setInterval(() => {
      this._accountService
        .getAccounts()
        .subscribe(accounts => (this.accounts = accounts));
    }, 5000);
  }

  update(e, accountId) {
    this._accountService
      .updateSync(accountId, e.target.checked)
      .subscribe(response => {
        this.isSaved = true;
        setTimeout(() => {
          this.isSaved = false;
        }, 3000);
      });
  }

  goToManageAccount(accountId) {
    this._router.navigate([""], { queryParams: { accountId: accountId } });
  }

  isSynced(time) {
    let now = Date.now();
    let difference = (now - time) / 60;

    // If the last sync date/time was more than 30 seconds then assume the syncing was completed.
    if (difference > 30) {
      return true;
    }

    return false;
  }
}
