import { Component, OnInit, Input, Output, EventEmitter } from "@angular/core";
import {} from "@angular/core";
import { TreeNode } from "./tree-node";
import { of } from "rxjs";

@Component({
  selector: "app-tree",
  templateUrl: "./tree.component.html",
  styleUrls: ["./tree.component.css"]
})
export class TreeComponent implements OnInit {
  @Input() treeData: TreeNode[];
  @Input() preSelectedSiteIdList: string[] = [];
  @Input() preSelectedWatcherList: string[] = [];
  @Output() selectedNode = new EventEmitter();

  ngOnInit() {}

  shouldBeChecked(node) {
    return this.preSelectedSiteIdList.includes(node.value.id);
  }

  isPreSelectedWatcherList(nodeValue) {
    if (this.preSelectedWatcherList[nodeValue.site.id]) {
      for (const iterator of this.preSelectedWatcherList[nodeValue.site.id]) {
        if (`${iterator}/`.includes(`${nodeValue.watchPath}/`)) {
          return true;
        }
      }
    }

    return false;
  }

  toggleChild(node) {
    node.showChildren = !node.showChildren;
  }

  showNode(node, event) {
    const isChecked =
      event instanceof Event
        ? (event.target as HTMLFormElement).checked
        : event.isChecked;

    this.selectedNode.emit({ node, isChecked });
  }

  onSelectedChange({ node, isChecked }) {
    this.selectedNode.emit({ node, isChecked });
  }
}
