import React from "react";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
} from "@dnd-kit/core";
import {
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, Tabs, Tooltip } from "antd";
import type { TabsProps as AntTabsProps } from "antd";
import { PlusOutlined } from "@ant-design/icons";

interface DraggableTabNodeProps extends React.HTMLAttributes<HTMLDivElement> {
  "data-node-key": string;
}

const DraggableTabNode: React.FC<DraggableTabNodeProps> = (props) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: props["data-node-key"],
    });

  const style: React.CSSProperties = {
    ...props.style,
    transform: CSS.Translate.toString(transform),
    transition,
    cursor: "move",
    display: "inline-block",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      {props.children}
    </div>
  );
};

interface SortableTabsProps extends Omit<AntTabsProps, "items"> {
  items: NonNullable<AntTabsProps["items"]>;
  onReorder: (from: number, to: number) => void;
  onAdd?: () => void;
  allowAdd?: boolean;
}

export const SortableTabs: React.FC<SortableTabsProps> = ({
  items,
  onReorder,
  onChange,
  onAdd,
  allowAdd = true,
  ...restProps
}) => {
  const sensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 10 },
  });

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (active.id !== over?.id && items) {
      const activeIndex = items.findIndex((i) => i.key === active.id);
      const overIndex = items.findIndex((i) => i.key === over?.id);
      if (activeIndex !== -1 && overIndex !== -1) {
        onReorder(activeIndex, overIndex);
      }
    }
  };

  return (
    <Tabs
      tabBarExtraContent={
        allowAdd ? (
          <Tooltip title="Add article" placement="left">
            <Button
              type="primary"
              size="middle"
              icon={<PlusOutlined />}
              onClick={onAdd}
              className="inline-flex items-center"
            >
              Add Article
            </Button>
          </Tooltip>
        ) : null
      }
      items={items}
      onChange={onChange}
      renderTabBar={(tabBarProps, DefaultTabBar) => (
        <DndContext
          sensors={[sensor]}
          onDragEnd={onDragEnd}
          collisionDetection={closestCenter}
        >
          <SortableContext
            items={items.map((i) => i.key)}
            strategy={horizontalListSortingStrategy}
          >
            <DefaultTabBar {...tabBarProps}>
              {(node) => {
                const el = node as React.ReactElement<Record<string, unknown>>;
                return (
                  <DraggableTabNode
                    {...(el.props || {})}
                    key={node.key}
                    data-node-key={String(node.key || "")}
                  >
                    {node}
                  </DraggableTabNode>
                );
              }}
            </DefaultTabBar>
          </SortableContext>
        </DndContext>
      )}
      {...restProps}
    />
  );
};

export default SortableTabs;
