export interface WatchList {
  siteName: string;
  siteId: string;
  documentLibraryId: string;
  watchNodeId: string;
  watchPath: string;
}

export interface WatchData {
  id: number;
  account_id: number;
  site_name: string;
  site_id: string;
  parent_node: string;
  watch_node: string;
  watch_folder: string;
  instance_url: string;
  sync_path: string;
  sync_enabled: number;
  last_synced_at: number;
  sync_in_progress: number;
}
