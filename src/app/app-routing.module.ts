import { NgModule } from "@angular/core";
import { Routes, RouterModule } from "@angular/router";

import { InstanceInfoComponent } from "./accounts/instance-info/instance-info.component";
import { RemoteFolderComponent } from "./accounts/remote-folder/remote-folder.component";
import { CustomizeFolderComponent } from "./accounts/customize-folder/customize-folder.component";
import { FinalizeComponent } from "./accounts/finalize/finalize.component";

const routes: Routes = [
  {
    path: "",
    component: InstanceInfoComponent
  },
  {
    path: "account-remote-folder",
    component: RemoteFolderComponent
  },
  {
    path: "account-customize-folder",
    component: CustomizeFolderComponent
  },
  {
    path: "account-finalize",
    component: FinalizeComponent
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
