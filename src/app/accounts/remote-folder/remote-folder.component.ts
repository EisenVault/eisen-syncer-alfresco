import { Component, OnInit } from "@angular/core";
import { Router, ActivatedRoute, ParamMap } from "@angular/router";
import { SiteService } from "../../services/site.service";
import { NodeService } from "../../services/node.service";
import { WatchNodeService } from "../../services/watch-node.service";

@Component({
  selector: "app-remote-folder",
  templateUrl: "./remote-folder.component.html",
  styleUrls: ["./remote-folder.component.scss"]
})
export class RemoteFolderComponent implements OnInit {
  public accountId;
  public heading = "Which remote folder do you want to sync?";
  public sites;
  public nodes;
  public showSites: boolean = true;
  public showNodes: boolean = false;
  public selectedNodes = [];

  constructor(
    private _router: Router,
    private _route: ActivatedRoute,
    private _siteService: SiteService,
    private _nodeService: NodeService,
    private _watchNodeService: WatchNodeService
  ) {}

  ngOnInit() {
    this._route.paramMap.subscribe(params => {
      this.accountId = params.get("accountId");
    });

    this.loadSites();
  }

  loadSites() {
    this.selectedNodes = [];
    this._siteService.getSites(this.accountId).subscribe(response => {
      this.sites = (<any>response).list.entries;
      this.showSites = true;
      this.showNodes = false;
    });
  }

  loadNodes(nodeId) {
    this._nodeService.getNodes(this.accountId, nodeId).subscribe(response => {
      this.nodes = (<any>response).list.entries;
      this.showSites = false;
      this.showNodes = true;
    });
  }

  goBack() {
    this._router.navigate([""]);
  }

  finalize() {
    console.log(this.selectedNodes);
    this._watchNodeService.addWatchNodes(this.accountId, this.selectedNodes);
  }
}
