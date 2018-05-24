import { Component, OnInit } from "@angular/core";
import { Router, ActivatedRoute, ParamMap } from "@angular/router";
import { SiteService } from "../../services/site.service";
import { NodeService } from "../../services/node.service";
import { ParentNodeService } from "../../services/parent-node.service";
import { WatchNodeService } from "../../services/watch-node.service";

@Component({
  selector: "app-remote-folder",
  templateUrl: "./remote-folder.component.html",
  styleUrls: ["./remote-folder.component.scss"]
})
export class RemoteFolderComponent implements OnInit {
  public accountId;
  public sites = [];
  public nodes = [];
  public showSites: boolean = true;
  public showNodes: boolean = false;
  public selectedNodes: string[] = [];
  public parentNodeId: string = "";

  constructor(
    private _router: Router,
    private _route: ActivatedRoute,
    private _siteService: SiteService,
    private _nodeService: NodeService,
    private _watchNodeService: WatchNodeService,
    private _parentNodeService: ParentNodeService
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
    this.selectedNodes = [];
    this._nodeService.getNodes(this.accountId, nodeId).subscribe(response => {
      this.nodes = (<any>response).list.entries;
      this.showSites = false;
      this.showNodes = true;
    });
  }

  loadParent() {
    if (this.selectedNodes.length > 0) {
      let nodeId = this.selectedNodes[0];

      this._parentNodeService
        .getParents(this.accountId, nodeId)
        .subscribe(response => {
          console.log( response );
          
          // for (let parent of test.entries) {
          //   this.parentNodeId = parent.entry.id;
          // }
        });
    }
  }

  addToList(e, nodeId) {
    if (e.target.value == "true") {
      return this.selectedNodes.push(nodeId);
    }

    let index = this.selectedNodes.indexOf(nodeId);
    return this.selectedNodes.splice(index, 1);
  }

  goBack() {
    this._router.navigate([""], { queryParams: { accountId: this.accountId } });
  }

  finalize() {
    this._watchNodeService
      .addWatchNodes(this.accountId, this.selectedNodes)
      .subscribe(
        response => {
          this._router.navigate(["account-finalize", this.accountId]);
        },
        error => console.log("sm er occ", error)
      );
  }
}
