import { NgModule } from "@angular/core";
import { Routes, RouterModule } from "@angular/router";

import { InstanceInfoComponent } from "./accounts/instance-info/instance-info.component";
import { RemoteFolderComponent } from "./accounts/remote-folder/remote-folder.component";
import { FinalizeComponent } from "./accounts/finalize/finalize.component";

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
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
