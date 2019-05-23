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
  public preSelectedWatcherList = [];
  private latestItem: any;
  public folders: TreeNode[] = [];
  public documentLibrary = "";

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

  clearAllSelectedFolders() {
    const confirmation = confirm(
      "This will clear all pre-selected departments/folders. Continue?"
    );
    if (confirmation) {
      this.selectedList = [];
      this.preSelectedSiteIdList = [];
      this.preSelectedWatcherList = [];
    }
  }

  onSelectedChange({ node, isChecked }) {
    this.latestItem = node.value;

    this.loadFolders({
      site: node.value.site,
      parentId: node.value.id
    });

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
  }

  loadSites() {
    this.isLoading = true;
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
              checkboxVisible: false,
              showChildren: true,
              value: {
                id: item.entry.guid,
                site: {
                  id: item.entry.guid,
                  siteId: item.entry.id,
                  siteTitle: item.entry.title
                },
                parentId: item.entry.guid,
                watchPath: `/Company Home/Sites/${item.entry.id}`,
                documentLibrary: item.entry.guid
              },
              children: []
            });
          });

          this.folders = siteList;

          result.map(resultItem => {
            this.preSelectedSiteIdList.push(resultItem.watch_node);

            // This is to change the folder color in case if the node or any of its decendends was preselected.
            if (!this.preSelectedWatcherList[resultItem.site_id]) {
              this.preSelectedWatcherList[resultItem.site_id] = [];
            }
            this.preSelectedWatcherList[resultItem.site_id].push(
              resultItem.watch_folder
            );

            this.selectedList.push({
              id: resultItem.watch_node,
              site: {
                id: resultItem.site_id,
                siteId: resultItem.site_name
              },
              parentId: resultItem.parent_node,
              watchPath: resultItem.watch_folder,
              documentLibrary: resultItem.document_library_node
            });

            if (this.selectedList && this.selectedList.length > 0) {
              this.disableFinish = false;
            }
          });

          this.isLoading = false;
          console.log("selectedList Count", this.selectedList.length);
        });
    });
  }

  loadFolders({ site, parentId }) {
    this._nodeService.getNodes(this.accountId, parentId).subscribe(response => {
      for (const item of (<any>response).list.entries) {
        if (item.entry.name === "documentLibrary") {
          this.documentLibrary = item.entry.id;
        }
        this.recursiveFolderSearch({
          folders: this.folders,
          site,
          parentId,
          item
        });
      }
    });
  }

  recursiveFolderSearch({ folders, site, parentId, item }) {
    folders.map(folderItem => {
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

        folderItem.children.push({
          name: item.entry.name,
          checkboxVisible: true,
          showChildren: true,
          value: {
            id: item.entry.id,
            site,
            parentId: item.entry.parentId,
            watchPath: `${item.entry.path.name}/${item.entry.name}`,
            documentLibrary: this.documentLibrary
          },
          children: []
        });
      } else if (typeof folderItem.children !== "undefined") {
        return this.recursiveFolderSearch({
          folders: folderItem.children,
          site,
          parentId,
          item
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
    this.isLoading = true;
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
