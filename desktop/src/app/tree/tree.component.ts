import { Component, OnInit, Input, Output, EventEmitter } from "@angular/core";
import {} from "@angular/core";
import { TreeNode } from "./tree-node";

@Component({
  selector: "app-tree",
  templateUrl: "./tree.component.html",
  styleUrls: ["./tree.component.css"]
})
export class TreeComponent implements OnInit {
  @Input() treeData: TreeNode[];
  @Input() preSelectedSiteIdList: string[] = [];
  @Output() selectedNode = new EventEmitter();

  ngOnInit() {}

  shouldBeChecked(node) {
    return this.preSelectedSiteIdList.includes(node.value.id);
  }

  toggleChild(node) {
    if (node.showChildren) {
      this.showNode(node, { isChecked: this.shouldBeChecked(node) });
    }
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
