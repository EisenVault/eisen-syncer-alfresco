import { Component, OnInit } from "@angular/core";
import { LogService } from "../../services/log.service";
import { ActivatedRoute } from "@angular/router";

@Component({
  selector: "app-error",
  templateUrl: "./error.component.html",
  styleUrls: ["./error.component.scss"]
})
export class ErrorComponent implements OnInit {
  public logs;

  constructor(
    private _logService: LogService,
    private _activatedRoute: ActivatedRoute
  ) {}

  ngOnInit() {
    this._activatedRoute.queryParams.subscribe(params => {
      let accountId = params["accountId"] || 0;
      this._logService
        .getErrors(accountId)
        .subscribe(response => (this.logs = response));
    });
  }
}
