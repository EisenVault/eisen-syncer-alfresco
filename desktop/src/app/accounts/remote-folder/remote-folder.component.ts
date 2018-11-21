import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { SiteService } from '../../services/site.service';
import { NodeService } from '../../services/node.service';
import { AccountService } from '../../services/account.service';
import { WatchData, WatchList } from '../../models/watcher';

@Component({
  selector: 'app-remote-folder',
  templateUrl: './remote-folder.component.html',
  styleUrls: ['./remote-folder.component.scss']
})
export class RemoteFolderComponent implements OnInit {
  public accountId;
  public disableFinish = true;
  public isLoading = false;
  public sites = [];
  public isSelectAllChecked = false;
  public selectedList: WatchList[] = [];
  public preSelectedSiteIdList = [];

  constructor(
    private _router: Router,
    private _route: ActivatedRoute,
    private _siteService: SiteService,
    private _nodeService: NodeService,
    private _accountService: AccountService,
  ) { }

  ngOnInit() {
    this._route.paramMap.subscribe(params => {
      this.accountId = params.get('accountId');
      this.loadSites();
    });
  }

  loadSites() {
    this._siteService.getSites(this.accountId).subscribe(response => {
      this.sites = (<any>response).list.entries;

      this._siteService.getWatchers(this.accountId).subscribe((result: WatchData[]) => {
        console.log('length', this.sites.length, result.length);

        if (this.sites.length === result.length) {
          this.isSelectAllChecked = true;
        }

        result.map((item) => {
          this.preSelectedSiteIdList.push(item.site_id);
          this.selectedList.push({
            siteName: item.site_name,
            siteId: item.site_id,
            documentLibraryId: item.document_library_node,
            watchNodeId: item.watch_node,
            watchPath: item.watch_folder
          });

          if (this.selectedList.length > 0) {
            this.disableFinish = false;
          }

        });
      });

    });
  }

  selectAll(event) {
    this.disableFinish = true;
    this.selectedList = [];
    const siteCheckboxes = document.getElementsByClassName('site-checkbox');

    if (event.target.checked === true) {
      this.isLoading = true;
      [].forEach.call(siteCheckboxes, function (cb) {
        cb.checked = true;
      });

      setTimeout(() => {
        this.disableFinish = false;
        this.isLoading = false;
      }, this.sites.length * 500);

      this.sites.map(site => {
        this._nodeService.getNodes(this.accountId, site.entry.guid).subscribe(response => {
          for (const item of (<any>response).list.entries) {
            if (item.entry.name === 'documentLibrary') {
              const lastElement = item.entry.path.elements.pop();
              const siteName = lastElement.name;
              const siteId = lastElement.id;
              const documentLibraryId = item.entry.id;
              const watchNodeId = item.entry.id;
              const watchPath = `${item.entry.path.name}/${item.entry.name}`;

              this.selectedList.push({
                siteName,
                siteId,
                documentLibraryId,
                watchNodeId,
                watchPath
              });
              break;
            }
          }
        });
      });
    } else {
      [].forEach.call(siteCheckboxes, function (cb) {
        cb.checked = false;
      });
      this.disableFinish = true;
      this.selectedList = [];
    }
  }

  setSite(e, site) {
    this.isSelectAllChecked = false;

    if (e.target.checked === true) {

      this._nodeService.getNodes(this.accountId, site.guid).subscribe(response => {

        for (const item of (<any>response).list.entries) {

          if (item.entry.name === 'documentLibrary') {

            const lastElement = item.entry.path.elements.pop();
            const siteName = lastElement.name;
            const siteId = lastElement.id;
            const documentLibraryId = item.entry.id;
            const watchNodeId = item.entry.id;
            const watchPath = `${item.entry.path.name}/${item.entry.name}`;

            this.selectedList.push({
              siteName,
              siteId,
              documentLibraryId,
              watchNodeId,
              watchPath
            });

            this.disableFinish = false;
            break;
          }
        }
      });

    } else {

      // If site is unchecked, remove it's reference from the list
      this.selectedList.map((item, index) => {
        if (item.siteId === site.guid) {
          this.selectedList.splice(index, 1);
        }
      });

      this.disableFinish = false;
    }

    if (this.selectedList.length === 0) {
      this.disableFinish = true;
    }
  }

  goBack() {
    this._router.navigate(['account-new'], {
      queryParams: { accountId: this.accountId }
    });
  }

  finalize() {
    this._accountService
      .updateWatchNode(
        this.accountId,
        this.selectedList
      )
      .subscribe(
        () => {
          // Move to the next screen
          this._router.navigate(['account-finalize', this.accountId]);
        },
        error => console.log(error)
      );
  }
}
