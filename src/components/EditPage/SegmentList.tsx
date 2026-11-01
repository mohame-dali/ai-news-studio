import React, { FC } from "react";
import { ManuscriptType, SegmentType } from "@/types";
import { Flex, Form, Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import Segment from "./Segment";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { cameraMovements, moods, textPlacements } from "@/lib/constants";
import { fr } from "@/lib/i18n";

interface Props {
  index: number;
  manuscript: ManuscriptType;
}

export const SegmentList: FC<Props> = ({ index }) => {
  const form = Form.useFormInstance();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  return (
    <Form.List name={[index, "manuscript", "segments"]}>
      {(segments, { add, remove, move }) => {
        const segmentList: SegmentType[] =
          form.getFieldValue(["tabs", index, "manuscript", "segments"]) || [];

        function handleDuplicate(segmentNumber: number) {
          const currentValue = form.getFieldValue([
            "tabs",
            index,
            "manuscript",
            "segments",
            segmentNumber,
          ]);
          add(
            {
              ...currentValue,
              id: `seg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            },
            segmentNumber + 1
          );
        }

        function handleAdd(position: number) {
          add(
            {
              id: `seg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              mood: moods[0]?.id || "neutral",
              cameraMovement: cameraMovements[0]?.id || "zoom-in",
              style: textPlacements[0]?.id || "bottom",
              type: "segment",
              text: "",
              texts: [],
            },
            position + 1
          );
        }

        function handleDragEnd(event: DragEndEvent) {
          const { active, over } = event;
          if (over && active.id !== over.id) {
            const oldIndex = segmentList.findIndex(
              (item) => String(item.id) === String(active.id)
            );
            const newIndex = segmentList.findIndex(
              (item) => String(item.id) === String(over.id)
            );
            if (oldIndex !== -1 && newIndex !== -1) {
              move(oldIndex, newIndex);
            }
          }
        }

        const items = segmentList.map((s) => String(s.id));

        return (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items}
              strategy={verticalListSortingStrategy}
            >
              <Flex vertical gap="middle">
                {segments.map((segment, segmentIdx) => {
                  const segItem = segmentList[segment.name] || {};
                  const id = segItem.id || `seg-${segmentIdx}`;
                  const position = segmentIdx;

                  return (
                    <Segment
                      key={id}
                      id={id}
                      manuscriptIndex={index}
                      position={position}
                      onDuplicate={() => handleDuplicate(position)}
                      onAdd={() => handleAdd(position)}
                      onRemove={() => remove(position)}
                    />
                  );
                })}

                {segments.length === 0 && (
                  <div className="p-8 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl text-center">
                    <p className="text-gray-500 mb-3">{fr.editor.noSegments}</p>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => handleAdd(0)}
                    >
                      {fr.editor.addFirstSegment}
                    </Button>
                  </div>
                )}
              </Flex>
            </SortableContext>
          </DndContext>
        );
      }}
    </Form.List>
  );
};

export default SegmentList;
