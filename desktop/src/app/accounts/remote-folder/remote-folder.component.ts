import { Component, OnInit } from "@angular/core";
import { Router, ActivatedRoute } from "@angular/router";
import { SiteService } from "../../services/site.service";
import { NodeService } from "../../services/node.service";
import { AccountService } from "../../services/account.service";
import { WatchData } from "../../models/watcher";
import { TreeNode } from "../../tree/tree-node";

@Component({
  selector: "app-remote-folder",
  templateUrl: "./remote-folder.component.html",
  styleUrls: ["./remote-folder.component.scss"]
})
export class RemoteFolderComponent implements OnInit {
  public accountId;
  public disableFinish = true;
  public isLoading = false;
  public soSiteData = false;
  public isEdit = false;
  public sites = [];
  public selectedList: any[] = [];
  public preSelectedSiteIdList = [];
  private latestItem: any;
  public folders: TreeNode[] = [];

  constructor(
    private _router: Router,
    private _route: ActivatedRoute,
    private _siteService: SiteService,
    private _nodeService: NodeService,
    private _accountService: AccountService
  ) {}

  ngOnInit() {
    this._route.paramMap.subscribe(params => {
      this.accountId = params.get("accountId");
      this.loadSites();
    });

    this._route.queryParams.subscribe(param => {
      this.isEdit = param["edit"] === "true" ? true : false;
    });
  }

  onSelectedChange({ node, isChecked }) {
    this.latestItem = node.value;

    // If the node was unchecked, remove it from the selectedList
    if (!isChecked) {
      this.selectedList = this.selectedList.filter(
        el => el.id !== node.value.id
      );
      this.setFinishButtonState();
      return;
    }

    // If the checkbox is checked, verify if the nodeId already exist in the selectedList array
    const existingNodeIdList = [];
    this.selectedList.forEach(el => {
      if (el.id === node.value.id) {
        existingNodeIdList.push(el.id);
      }
    });

    // If the item does not exist in the array then only add it
    if (!existingNodeIdList.includes(node.value.id)) {
      this.selectedList.push(this.latestItem);
    }

    this.setFinishButtonState();

    this.loadFolders({
      site: node.value.site,
      parentId: node.value.id
    });
  }

  loadSites() {
    this._siteService.getSites(this.accountId).subscribe(response => {
      this.sites = (<any>response).list.entries;

      if (this.sites && this.sites.length === 0) {
        this.soSiteData = true;
        this.disableFinish = true;
        return;
      }

      this._siteService
        .getWatchers(this.accountId)
        .subscribe((result: WatchData[]) => {
          const siteList = [];

          this.sites.forEach(item => {
            siteList.push({
              name: item.entry.title,
              showChildren: true,
              value: {
                id: item.entry.guid,
                site: {
                  id: item.entry.guid,
                  siteId: item.entry.id,
                  siteTitle: item.entry.title
                },
                parentId: item.entry.guid,
                watchPath: `/Company Home/Sites/${item.entry.id}`
              },
              children: []
            });
          });

          this.folders = siteList;

          result.map(item => {
            this.preSelectedSiteIdList.push(item.watch_node);

            this.selectedList.push({
              id: item.watch_node,
              site: {
                id: item.site_id,
                siteId: item.site_name
              },
              parentId: item.parent_node,
              watchPath: item.watch_folder
            });

            if (this.selectedList && this.selectedList.length > 0) {
              this.disableFinish = false;
            }
          });
        });
    });
  }

  loadFolders({ site, parentId }) {
    this._nodeService.getNodes(this.accountId, parentId).subscribe(response => {
      for (const item of (<any>response).list.entries) {
        this.recursiveFolderSearch({
          folders: this.folders,
          site,
          parentId,
          item,
          documentLibrary: ""
        });
      }
    });
  }

  recursiveFolderSearch({ folders, site, parentId, item, documentLibrary }) {
    folders.map(folderItem => {
      documentLibrary = folderItem.value.documentLibrary || "";

      if (folderItem.value.id === this.latestItem.id) {
        // Check whether the item already exists in the children array, bail out if it does.
        const itemExists = folderItem.children.map(el => {
          if (el.value.id === item.entry.id) {
            return true;
          }
        });

        // Looks like the item was already populated on screen, bail out!
        if (itemExists.includes(true)) {
          return;
        }

        if (item.entry.name === "documentLibrary") {
          documentLibrary = item.entry.id;
        }

        folderItem.children.push({
          name: item.entry.name,
          showChildren: true,
          value: {
            id: item.entry.id,
            site,
            parentId: item.entry.parentId,
            watchPath: `${item.entry.path.name}/${item.entry.name}`,
            documentLibrary
          },
          children: []
        });
      } else if (typeof folderItem.children !== "undefined") {
        return this.recursiveFolderSearch({
          folders: folderItem.children,
          site,
          parentId,
          item,
          documentLibrary
        });
      }
    });
  }

  goBack() {
    if (this.isEdit === true) {
      return this._router.navigate(["account-details"], {
        queryParams: { accountId: this.accountId }
      });
    }

    this._router.navigate(["account-new"], {
      queryParams: { accountId: this.accountId }
    });
  }

  finalize() {
    this._accountService
      .updateWatchNode(this.accountId, this.selectedList)
      .subscribe(
        () => {
          // Move to the next screen
          if (this.isEdit === true) {
            this._router.navigate(["account-details"], {
              queryParams: { accountId: this.accountId }
            });
          } else {
            this._router.navigate(["account-finalize", this.accountId]);
          }
        },
        error => console.log(error)
      );
  }

  setFinishButtonState() {
    this.disableFinish = true;
    if (this.selectedList && this.selectedList.length > 0) {
      this.disableFinish = false;
    }
  }
}
