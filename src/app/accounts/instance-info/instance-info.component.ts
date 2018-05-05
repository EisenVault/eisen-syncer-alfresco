import { Component, OnInit } from "@angular/core";
import { AccountService } from "../../services/account.service";

@Component({
  selector: "app-instance-info",
  templateUrl: "./instance-info.component.html",
  styleUrls: ["./instance-info.component.scss"]
})
export class InstanceInfoComponent implements OnInit {
  public records;

  constructor(private _accountService: AccountService) {}

  ngOnInit() {
    this._accountService.fetchData().subscribe(response => {
      console.log(response);

      this.records = response;
    });
  }
}
