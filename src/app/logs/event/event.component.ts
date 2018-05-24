import { Component, OnInit } from "@angular/core";
import { LogService } from "../../services/log.service";
import { ActivatedRoute } from "@angular/router";

@Component({
  selector: "app-event",
  templateUrl: "./event.component.html",
  styleUrls: ["./event.component.scss"]
})
export class EventComponent implements OnInit {
  public logs;

  constructor(
    private _logService: LogService,
    private _activatedRoute: ActivatedRoute
  ) {}

  ngOnInit() {
    this._activatedRoute.queryParams.subscribe(params => {
      let accountId = params["accountId"] || 0;
      this._logService
        .getEvents(accountId)
        .subscribe(response => (this.logs = response));
    });
  }

  getBadgeClass($type) {
    switch ($type) {
      case "UPLOAD_FOLDER":
        return "badge badge-primary";
      case "UPLOAD_FILE":
        return "badge badge-secondary";
      case "DOWNLOAD_FILE":
        return "badge badge-info";
      case "DELETE_FILE":
      case "DELETE_FOLDER":
      case "DELETE_NODE":
        return "badge badge-danger";
      default:
        return "badge badge-warning";
    }
  }
}
