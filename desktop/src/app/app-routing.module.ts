import BugsnagErrorHandler from "bugsnag-angular";
import bugsnag from "bugsnag-js";
const bugsnagClient = bugsnag("3613b87fd26a90eadb81aa07e847d6bf");

export function errorHandlerFactory() {
  return new BugsnagErrorHandler(bugsnagClient);
}

import { NgModule, ErrorHandler } from "@angular/core";
import { Routes, RouterModule } from "@angular/router";

import { InstanceInfoComponent } from "./accounts/instance-info/instance-info.component";
import { RemoteFolderComponent } from "./accounts/remote-folder/remote-folder.component";
import { FinalizeComponent } from "./accounts/finalize/finalize.component";
import { ManageComponent } from "./accounts/manage/manage.component";
import { DetailComponent } from "./accounts/detail/detail.component";
import { CredentialsComponent } from "./accounts/credentials/credentials.component";
import { SyncPathComponent } from "./accounts/sync-path/sync-path.component";
import { ErrorComponent } from "./logs/error/error.component";
import { EventComponent } from "./logs/event/event.component";
import { AboutComponent } from "./about/about.component";
import { SettingsComponent } from "./settings/settings.component";

const routes: Routes = [
  {
    path: "",
    component: ManageComponent
  },
  {
    path: "account-new",
    component: InstanceInfoComponent
  },
  {
    path: "account-remote-folder/:accountId",
    component: RemoteFolderComponent
  },
  {
    path: "account-finalize/:accountId",
    component: FinalizeComponent
  },
  {
    path: "account/manage",
    component: ManageComponent
  },
  {
    path: "account-details",
    component: DetailComponent
  },
  {
    path: "account-credentials",
    component: CredentialsComponent
  },
  {
    path: "account-sync-path",
    component: SyncPathComponent
  },
  {
    path: "logs/error",
    component: ErrorComponent
  },
  {
    path: "logs/event",
    component: EventComponent
  },
  {
    path: "about",
    component: AboutComponent
  },
  {
    path: "settings",
    component: SettingsComponent
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: true })],
  exports: [RouterModule],
  providers: [{ provide: ErrorHandler, useFactory: errorHandlerFactory }]
})
export class AppRoutingModule {}
