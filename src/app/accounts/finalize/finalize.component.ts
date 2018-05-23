import { Component, OnInit } from "@angular/core";
import { ElectronService } from "ngx-electron";
import { ActivatedRoute, ParamMap } from "@angular/router";
import { AccountService } from "../../services/account.service";

@Component({
  selector: "app-finalize",
  templateUrl: "./finalize.component.html",
  styleUrls: ["./finalize.component.scss"]
})
export class FinalizeComponent implements OnInit {
  public accountId: string = "";

  constructor(
    private _electronService: ElectronService,
    private _activatedRoute: ActivatedRoute,
    private _accountService: AccountService
  ) {}

  ngOnInit() {
    this._activatedRoute.paramMap.subscribe(params => {
      this.accountId = params.get("accountId");
    });
  }

  openFolder() {
    this._accountService.getAccount(this.accountId).subscribe(response => {
      if (this._electronService.isElectronApp) {
        this._electronService.shell.openItem((<any>response).sync_path);
      }
    });
  }
}
