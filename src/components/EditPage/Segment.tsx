import React, { FC } from "react";
import { Bars3Icon } from "@heroicons/react/20/solid";
import {
  Button,
  Card,
  Col,
  Flex,
  Form,
  Input,
  Row,
  Select,
  Switch,
  Tag,
  Tooltip,
} from "antd";
import {
  CopyOutlined,
  DeleteOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { cameraMovements, moods, textPlacements } from "@/lib/constants";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import MediaAsset from "./MediaAsset";
import AudioRecorder from "../AudioRecorder/AudioRecorder";
import { fr } from "@/lib/i18n";

interface SegmentProps {
  id: string | number;
  position: number;
  onDuplicate: () => void;
  onRemove: () => void;
  onAdd: () => void;
  manuscriptIndex: number;
}

export const Segment: FC<SegmentProps> = ({
  id,
  manuscriptIndex,
  position,
  onAdd,
  onDuplicate,
  onRemove,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: String(id) });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    width: "100%",
  };

  const form = Form.useFormInstance();
  const allMedia = form?.getFieldValue([
    "tabs",
    manuscriptIndex,
    "manuscript",
    "media",
  ]) || [];

  return (
    <div ref={setNodeRef} style={style}>
      <Card
        className="w-full shadow-xs hover:shadow-md transition-shadow"
        styles={{ body: { paddingBottom: 12, paddingTop: 16 } }}
      >
        <Flex align="start" gap="middle" justify="space-between">
          {/* Drag Handle */}
          <div
            className="cursor-move p-2 mt-2 text-gray-400 hover:text-gray-700 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            {...attributes}
            {...listeners}
            title={fr.editor.dragHandleTooltip}
          >
            <Bars3Icon className="w-5 h-5" aria-hidden="true" />
          </div>

          {/* Media Thumbnail & Picker */}
          <div className="w-[140px] sm:w-[170px] shrink-0">
            <Form.Item
              name={[position, "mainMedia"]}
              className="mb-0"
            >
              <MediaAsset allMedia={allMedia} />
            </Form.Item>
          </div>

          {/* Content & Settings */}
          <Flex vertical flex="auto" className="min-w-0">
            <Form.Item className="mb-2">
              <Form.Item noStyle name={[position, "text"]}>
                <Input.TextArea
                  rows={3}
                  placeholder={fr.editor.textPlaceholder}
                  className="font-medium"
                />
              </Form.Item>
              <div className="mt-1 text-[11px] text-gray-500">
                {fr.editor.pronunciationHint}
              </div>
            </Form.Item>

            <Row gutter={[12, 12]}>
              <Col xs={24} sm={8} key="mood">
                <Form.Item label={fr.editor.moodLabel} name={[position, "mood"]} className="mb-2">
                  <Select
                    options={moods.map((m) => ({
                      value: m.id,
                      label: m.name,
                    }))}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} sm={8} key="style">
                <Form.Item label={fr.editor.placementLabel} name={[position, "style"]} className="mb-2">
                  <Select
                    options={textPlacements.map((t) => ({
                      value: t.id,
                      label: t.name,
                    }))}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} sm={8} key="camera">
                <Form.Item
                  label={fr.editor.cameraLabel}
                  name={[position, "cameraMovement"]}
                  className="mb-2"
                >
                  <Select
                    options={cameraMovements.map((c) => ({
                      value: c.id,
                      label: c.name,
                    }))}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12} key="graphicMode">
                <Form.Item label="Mode Graphique / Visuel" name={[position, "graphicMode"]} className="mb-2">
                  <Select
                    defaultValue="auto"
                    options={[
                      { value: "auto", label: "Auto (Chiffre / Citation / Média)" },
                      { value: "none", label: "Média plein écran uniquement" },
                      { value: "number", label: "Grand Chiffre clé animé (Yellow)" },
                      { value: "quote", label: "Citation déclarative (Italique)" },
                      { value: "map", label: "Repère cartographique" },
                    ]}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12} key="licenseValidation">
                <div className="p-2 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-md">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-1">
                      <SafetyCertificateOutlined /> Carte de Droits
                    </span>
                    <Tag color="blue" className="text-[10px] m-0">
                      Conformité Légale
                    </Tag>
                  </div>
                  <Form.Item
                    name={[position, "licenseValidated"]}
                    valuePropName="checked"
                    className="mb-0"
                    initialValue={true}
                  >
                    <Switch
                      checkedChildren="Licence certifiée"
                      unCheckedChildren="Licence non certifiée"
                      className="w-full text-xs"
                    />
                  </Form.Item>
                </div>
              </Col>
            </Row>

            <Flex justify="space-between" align="center" className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <Form.Item name={[position, "customAudio"]} className="mb-0">
                <AudioRecorder />
              </Form.Item>

              <Flex gap="small">
                <Tooltip title={fr.editor.addBelowTooltip}>
                  <Button
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={onAdd}
                  />
                </Tooltip>
                <Tooltip title={fr.editor.duplicateTooltip}>
                  <Button
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={onDuplicate}
                  />
                </Tooltip>
                <Tooltip title={fr.editor.deleteTooltip}>
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={onRemove}
                  />
                </Tooltip>
              </Flex>
            </Flex>
          </Flex>
        </Flex>
      </Card>
    </div>
  );
};

export default Segment;
