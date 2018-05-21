import { Component, OnInit } from "@angular/core";
import { Router, ActivatedRoute, ParamMap } from "@angular/router";

@Component({
  selector: "app-remote-folder",
  templateUrl: "./remote-folder.component.html",
  styleUrls: ["./remote-folder.component.scss"]
})
export class RemoteFolderComponent implements OnInit {
  public accountId;

  constructor(private _router: Router, private _route: ActivatedRoute) {}

  ngOnInit() {
    // this._route.paramMap.subscribe(params => {
    //   this.accountId = params.get("accountId");     
    // });

    // console.log( 'this.accountId222', this._route.snapshot.params['accountId'] );
    

  }

  goBack() {
    this._router.navigate(["home"]);
  }
}
