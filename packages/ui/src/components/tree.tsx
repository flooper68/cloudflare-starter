import { ChevronRight } from "lucide-react";
import {
  type KeyboardEvent,
  type ReactNode,
  useMemo,
  useRef,
  useState,
} from "react";

import { cn } from "../lib/utils";

export interface TreeNode {
  readonly id: string;
  readonly label: ReactNode;
  /** Text used for type-ahead and the accessible name when `label` is not a string. */
  readonly textValue?: string;
  readonly icon?: ReactNode;
  /** Muted content at the right: a count, a progress figure. */
  readonly trailing?: ReactNode;
  readonly children?: readonly TreeNode[];
  readonly disabled?: boolean;
}

interface FlatNode {
  readonly node: TreeNode;
  readonly level: number;
  readonly parentId: string | null;
}

function flattenVisible(
  nodes: readonly TreeNode[],
  expanded: ReadonlySet<string>,
  level = 1,
  parentId: string | null = null,
  out: FlatNode[] = []
): FlatNode[] {
  for (const node of nodes) {
    out.push({ node, level, parentId });
    if (node.children?.length && expanded.has(node.id)) {
      flattenVisible(node.children, expanded, level + 1, node.id, out);
    }
  }
  return out;
}

export interface TreeProps {
  readonly items: readonly TreeNode[];
  /** Accessible name, e.g. "Projects". */
  readonly label: string;
  readonly expanded?: readonly string[];
  readonly defaultExpanded?: readonly string[];
  readonly onExpandedChange?: (expanded: string[]) => void;
  readonly selected?: string | null;
  readonly defaultSelected?: string | null;
  readonly onSelectedChange?: (id: string, node: TreeNode) => void;
  readonly className?: string;
}

/**
 * A nested, collapsible tree (e.g. projects > milestones > issues). Keyboard: Up/Down
 * move, Right expands or enters, Left collapses or goes to the parent, Home/End jump,
 * Enter/Space select, `*` expands all siblings. Follows the WAI-ARIA tree pattern.
 */
export function Tree({
  items,
  label,
  expanded: expandedProp,
  defaultExpanded = [],
  onExpandedChange,
  selected: selectedProp,
  defaultSelected = null,
  onSelectedChange,
  className,
}: TreeProps) {
  const [expandedState, setExpandedState] =
    useState<readonly string[]>(defaultExpanded);
  const [selectedState, setSelectedState] = useState<string | null>(
    defaultSelected
  );
  const expandedList = expandedProp ?? expandedState;
  const selected = selectedProp !== undefined ? selectedProp : selectedState;
  const expanded = useMemo(() => new Set(expandedList), [expandedList]);
  const visible = useMemo(
    () => flattenVisible(items, expanded),
    [items, expanded]
  );
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const nodeRefs = useRef(new Map<string, HTMLDivElement>());

  const tabStop =
    (focusedId && visible.some((v) => v.node.id === focusedId) && focusedId) ||
    (selected && visible.some((v) => v.node.id === selected) && selected) ||
    visible[0]?.node.id;

  const setExpanded = (next: string[]) => {
    if (expandedProp === undefined) setExpandedState(next);
    onExpandedChange?.(next);
  };
  const toggle = (id: string, open?: boolean) => {
    const isOpen = expanded.has(id);
    const shouldOpen = open ?? !isOpen;
    if (shouldOpen === isOpen) return;
    setExpanded(
      shouldOpen ? [...expandedList, id] : expandedList.filter((x) => x !== id)
    );
  };
  const select = (node: TreeNode) => {
    if (node.disabled) return;
    if (selectedProp === undefined) setSelectedState(node.id);
    onSelectedChange?.(node.id, node);
  };
  const focus = (id: string | undefined) => {
    if (!id) return;
    setFocusedId(id);
    nodeRefs.current.get(id)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, flat: FlatNode) => {
    event.stopPropagation();
    const { node } = flat;
    const index = visible.findIndex((v) => v.node.id === node.id);
    const hasChildren = Boolean(node.children?.length);
    const isOpen = expanded.has(node.id);

    switch (event.key) {
      case "ArrowDown":
        focus(visible[index + 1]?.node.id);
        break;
      case "ArrowUp":
        focus(visible[index - 1]?.node.id);
        break;
      case "Home":
        focus(visible[0]?.node.id);
        break;
      case "End":
        focus(visible[visible.length - 1]?.node.id);
        break;
      case "ArrowRight":
        if (hasChildren && !isOpen) toggle(node.id, true);
        else if (hasChildren) focus(visible[index + 1]?.node.id);
        break;
      case "ArrowLeft":
        if (hasChildren && isOpen) toggle(node.id, false);
        else focus(flat.parentId ?? undefined);
        break;
      case "Enter":
      case " ":
        select(node);
        break;
      case "*": {
        const siblings = visible
          .filter(
            (v) => v.parentId === flat.parentId && v.node.children?.length
          )
          .map((v) => v.node.id);
        setExpanded([...new Set([...expandedList, ...siblings])]);
        break;
      }
      default:
        return;
    }
    event.preventDefault();
  };

  const renderNodes = (
    nodes: readonly TreeNode[],
    level: number,
    parentId: string | null
  ): ReactNode =>
    nodes.map((node) => {
      const hasChildren = Boolean(node.children?.length);
      const isOpen = expanded.has(node.id);
      const isSelected = selected === node.id;
      const flat: FlatNode = { node, level, parentId };
      return (
        <div
          key={node.id}
          ref={(element) => {
            if (element) nodeRefs.current.set(node.id, element);
            else nodeRefs.current.delete(node.id);
          }}
          role="treeitem"
          aria-level={level}
          aria-expanded={hasChildren ? isOpen : undefined}
          aria-selected={isSelected}
          aria-disabled={node.disabled || undefined}
          aria-label={node.textValue}
          tabIndex={node.id === tabStop ? 0 : -1}
          onFocus={(event) => {
            event.stopPropagation();
            setFocusedId(node.id);
          }}
          onKeyDown={(event) => onKeyDown(event, flat)}
          onClick={(event) => {
            event.stopPropagation();
            select(node);
            if (hasChildren) toggle(node.id);
          }}
          className="group/tree-item outline-none"
        >
          <div
            style={{ paddingLeft: `${(level - 1) * 16 + 4}px` }}
            className={cn(
              "flex h-7 cursor-default select-none items-center gap-1.5 rounded-md pr-2 text-sm text-fg",
              "transition-colors duration-75 hover:bg-hover",
              "group-focus-visible/tree-item:ring-2 group-focus-visible/tree-item:ring-focus",
              isSelected && "bg-active",
              node.disabled && "pointer-events-none opacity-50",
              "[&_svg]:size-4 [&_svg]:shrink-0"
            )}
          >
            <span className="flex size-4 items-center justify-center text-fg-subtle">
              {hasChildren ? (
                <ChevronRight
                  aria-hidden
                  className={cn(
                    "size-3.5! transition-transform duration-150",
                    isOpen && "rotate-90"
                  )}
                />
              ) : null}
            </span>
            {node.icon ? (
              <span className="flex text-fg-muted">{node.icon}</span>
            ) : null}
            <span className="min-w-0 flex-1 truncate">{node.label}</span>
            {node.trailing ? (
              <span className="shrink-0 text-xs text-fg-subtle">
                {node.trailing}
              </span>
            ) : null}
          </div>
          {hasChildren && isOpen ? (
            // biome-ignore lint/a11y/useSemanticElements: the ARIA tree pattern nests treeitems in role=group.
            <div role="group">
              {renderNodes(node.children ?? [], level + 1, node.id)}
            </div>
          ) : null}
        </div>
      );
    });

  return (
    <div
      role="tree"
      aria-label={label}
      className={cn("flex flex-col", className)}
    >
      {renderNodes(items, 1, null)}
    </div>
  );
}
