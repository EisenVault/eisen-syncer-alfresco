import { NgModule } from "@angular/core";
import { Routes, RouterModule } from "@angular/router";

import { InstanceInfoComponent } from "./accounts/instance-info/instance-info.component";
import { RemoteFolderComponent } from "./accounts/remote-folder/remote-folder.component";
import { FinalizeComponent } from "./accounts/finalize/finalize.component";
import { ManageComponent } from "./accounts/manage/manage.component";
import { ErrorComponent } from "./logs/error/error.component";
import { EventComponent } from "./logs/event/event.component";
import { AboutComponent } from "./about/about.component";
import { SettingsComponent } from "./settings/settings.component";

const routes: Routes = [
  {
    path: "",
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
  exports: [RouterModule]
})
export class AppRoutingModule {}
