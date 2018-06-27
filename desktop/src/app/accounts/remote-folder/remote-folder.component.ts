import { Component, OnInit } from "@angular/core";
import { Router, ActivatedRoute, ParamMap } from "@angular/router";
import { SiteService } from "../../services/site.service";
import { NodeService } from "../../services/node.service";
import { ParentNodeService } from "../../services/parent-node.service";
import { AccountService } from "../../services/account.service";

@Component({
  selector: "app-remote-folder",
  templateUrl: "./remote-folder.component.html",
  styleUrls: ["./remote-folder.component.scss"]
})
export class RemoteFolderComponent implements OnInit {
  public accountId;
  public sites = [];
  public nodes = [];
  public showSites: boolean = false;
  public showNodes: boolean = false;
  public showLevelUp: boolean = false;
  public selectedNode: string = '';
  public parentNodeId: string = "";

  constructor(
    private _router: Router,
    private _route: ActivatedRoute,
    private _siteService: SiteService,
    private _nodeService: NodeService,
    private _accountService: AccountService,
    private _parentNodeService: ParentNodeService
  ) {}

  ngOnInit() {
    this._route.paramMap.subscribe(params => {
      this.accountId = params.get("accountId");
    });

    this.loadSites();
  }

  loadSites() {
    this.selectedNode = '';
    this._siteService.getSites(this.accountId).subscribe(response => {
      this.sites = (<any>response).list.entries;
      this.showSites = true;
      this.showNodes = false;
    });
  }

  loadNodes(nodeId) {
    this.selectedNode = '';
    this._nodeService.getNodes(this.accountId, nodeId).subscribe(response => {
      this.showLevelUp = true;
      this.nodes = (<any>response).list.entries;
      this._setParentId();
      this.showSites = false;
      this.showNodes = true;

      for (let item of (<any>response).list.entries) {
        if (item.entry.name == "documentLibrary") {
          return (this.showLevelUp = false);
        }
      }
    });
  }

  _setParentId() {
    if (this.nodes && this.nodes.length > 0) {
      let nodeId = this.nodes[0].entry.id;

      this._parentNodeService
        .getParents(this.accountId, nodeId)
        .subscribe(response => {
          if ((<any>response).list.entries.length > 0) {
            this.parentNodeId = (<any>response).list.entries[0].entry.parentId;
          }
        });
    }
  }

  addToList(e, nodeId) {
    if (e.target.value == "true") {
      return this.selectedNode = nodeId;
    }

    return '';
  }

  goBack() {
    this._router.navigate(["account-new"], { queryParams: { accountId: this.accountId } });
  }

  finalize() {
    this._accountService
      .updateWatchNode(this.accountId, this.selectedNode)
      .subscribe(
        response => {
          this._router.navigate(["account-finalize", this.accountId]);
        },
        error => console.log(error)
      );
  }
}
