import { BrowserModule } from "@angular/platform-browser";
import { NgModule } from "@angular/core";
import { HttpClientModule } from "@angular/common/http";
import { FormsModule } from "@angular/forms";
import { NgxElectronModule } from "ngx-electron";

import { AccountService } from "./services/account.service";
import { SiteService } from "./services/site.service";
import { NodeService } from "./services/node.service";
import { LogService } from "./services/log.service";
import { ParentNodeService } from "./services/parent-node.service";
import { SettingService } from "./services/setting.service";
import { SyncerService } from "./services/syncer.service";

import { AppRoutingModule } from "./app-routing.module";
import { AppComponent } from "./app.component";

import { FinalizeComponent } from "./accounts/finalize/finalize.component";
import { RemoteFolderComponent } from "./accounts/remote-folder/remote-folder.component";
import { InstanceInfoComponent } from "./accounts/instance-info/instance-info.component";
import { AboutComponent } from "./about/about.component";
import { EventComponent } from "./logs/event/event.component";
import { ErrorComponent } from "./logs/error/error.component";
import { ManageComponent } from "./accounts/manage/manage.component";
import { SharedModule } from "./shared/shared.module";
import { SettingsComponent } from "./settings/settings.component";
import { DetailComponent } from './accounts/detail/detail.component';

@NgModule({
  declarations: [
    AppComponent,
    FinalizeComponent,
    RemoteFolderComponent,
    InstanceInfoComponent,
    AboutComponent,
    EventComponent,
    ErrorComponent,
    ManageComponent,
    SettingsComponent,
    DetailComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    FormsModule,
    NgxElectronModule,
    SharedModule
  ],
  providers: [
    AccountService,
    SiteService,
    NodeService,
    LogService,
    SettingService,
    ParentNodeService,
    SyncerService
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
