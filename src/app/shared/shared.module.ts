import { NgModule } from "@angular/core";
import { CleanStringPipe } from "./pipes/clean.pipe";

@NgModule({
    declarations: [CleanStringPipe],
    exports: [CleanStringPipe]
})
export class SharedModule {}
