import { Component, OnInit } from "@angular/core";
import { Router, ActivatedRoute, ParamMap } from "@angular/router";
import { SiteService } from "../../services/site.service";
import { NodeService } from "../../services/node.service";
import { ParentNodeService } from "../../services/parent-node.service";
import { AccountService } from "../../services/account.service";
import { SyncerService } from "../../services/syncer.service";

@Component({
  selector: "app-remote-folder",
  templateUrl: "./remote-folder.component.html",
  styleUrls: ["./remote-folder.component.scss"]
})
export class RemoteFolderComponent implements OnInit {
  public accountId;
  public sites = [];
  public nodes = [];
  public showSites = false;
  public showNodes = false;
  public showLevelUp = false;
  public selectedNode = '';
  public parentNodeId = '';
  public selectedSiteName = '';
  private watchFolder = '';

  constructor(
    private _router: Router,
    private _route: ActivatedRoute,
    private _siteService: SiteService,
    private _nodeService: NodeService,
    private _accountService: AccountService,
    private _syncerService: SyncerService,
    private _parentNodeService: ParentNodeService
  ) { }

  ngOnInit() {
    this._route.paramMap.subscribe(params => {
      this.accountId = params.get("accountId");
    });

    this.loadSites();
  }

  loadSites() {
    this.selectedNode = '';
    this.showLevelUp = false;
    this._siteService.getSites(this.accountId).subscribe(response => {
      this.sites = (<any>response).list.entries;
      this.showSites = true;
      this.showNodes = false;
    });
  }

  setSite(site) {
    this.selectedSiteName = site.id;
    this.loadNodes(site.guid);
  }

  loadNodes(nodeId) {
    this.selectedNode = '';
    this._nodeService.getNodes(this.accountId, nodeId).subscribe(response => {
      this.nodes = (<any>response).list.entries;
      this._setParentId();
      this.showLevelUp = true;
      this.showSites = false;
      this.showNodes = true;

      for (const item of (<any>response).list.entries) {
        if (item.entry.nodeType === 'st:site' || item.entry.nodeType === 'st:sites') {
          return this.loadSites();
        }
        if (item.entry.name === 'documentLibrary') {
          return (this.showLevelUp = false);
        }
      }
    });
  }

  _setParentId() {
    if (this.nodes && this.nodes.length > 0) {
      const nodeId = this.nodes[0].entry.id;

      this._parentNodeService
        .getParents(this.accountId, nodeId)
        .subscribe(response => {
          if ((<any>response).list.entries.length > 0) {
            this.parentNodeId = (<any>response).list.entries[0].entry.parentId;
          }
        });
    }
  }

  addToList(e, node) {
    if (e.target.value === 'true') {
      this.watchFolder = `${node.entry.path.name}/${node.entry.name}`;
      return this.selectedNode = node.entry.id;
    }

    return '';
  }

  goBack() {
    this._router.navigate(["account-new"], { queryParams: { accountId: this.accountId } });
  }

  finalize() {
    this._accountService
      .updateWatchNode(this.accountId, this.selectedSiteName, this.watchFolder, this.selectedNode)
      .subscribe(
        () => {
          // Start syncing
          this._syncerService.start(this.accountId);

          // Move to the next screen
          this._router.navigate(["account-finalize", this.accountId]);
        },
        error => console.log(error)
      );
  }
}
