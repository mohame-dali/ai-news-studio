import React, { FC } from "react";
import { MapType, MediaAssetType } from "@/types";
import { Form, Input, InputNumber, Modal, Space } from "antd";
import MapComponent from "../Map/MapComponent";
import ReplaceMedia from "./ReplaceMedia";
import { fr } from "@/lib/i18n";

interface Props {
  map?: MapType;
  onClose: () => void;
  onSave: (asset?: MediaAssetType) => void;
  alternativeMedia?: MediaAssetType[];
}

export const EditMap: FC<Props> = ({
  map,
  onClose,
  onSave,
  alternativeMedia = [],
}) => {
  const [form] = Form.useForm();

  const initialValues = {
    lat: map?.location?.lat ?? 59.9139,
    lon: map?.location?.lon ?? 10.7522,
    zoomStart: map?.location?.zoomStart ?? 6,
    byline: map?.byline || "Données cartographiques / OpenStreetMap",
  };

  const handleFinish = (values: {
    lat: number;
    lon: number;
    zoomStart: number;
    byline?: string;
  }) => {
    const updatedMap: MapType = {
      type: "map",
      byline: values.byline,
      location: {
        lat: Number(values.lat) || 0,
        lon: Number(values.lon) || 0,
        zoomStart: Number(values.zoomStart) || 6,
      },
    };
    onSave(updatedMap);
    onClose();
  };

  return (
    <Modal
      open
      title={fr.media.editMapTitle}
      onCancel={onClose}
      onOk={() => form.submit()}
      width={640}
      okText={fr.media.saveChanges}
      cancelText={fr.editor.cancel}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={initialValues}
        onFinish={handleFinish}
      >
        <Form.Item shouldUpdate className="mb-4">
          {() => {
            const lat = form.getFieldValue("lat") ?? 59.9139;
            const lon = form.getFieldValue("lon") ?? 10.7522;
            const zoom = form.getFieldValue("zoomStart") ?? 6;
            return (
              <div className="h-56 rounded-lg overflow-hidden border border-gray-200">
                <MapComponent location={{ lat, lon }} zoom={zoom} />
              </div>
            );
          }}
        </Form.Item>

        <Space className="w-full flex" size="large">
          <Form.Item name="lat" label={fr.media.latitude} rules={[{ required: true }]}>
            <InputNumber step={0.01} precision={4} style={{ width: 140 }} />
          </Form.Item>
          <Form.Item name="lon" label={fr.media.longitude} rules={[{ required: true }]}>
            <InputNumber step={0.01} precision={4} style={{ width: 140 }} />
          </Form.Item>
          <Form.Item name="zoomStart" label={fr.media.zoomLevel}>
            <InputNumber min={2} max={18} step={1} style={{ width: 120 }} />
          </Form.Item>
        </Space>

        <Form.Item name="byline" label={fr.media.mapAttribution}>
          <Input placeholder="Ex : IGN / OpenStreetMap / Données Cartographiques" />
        </Form.Item>

        <ReplaceMedia
          alternativeMedia={alternativeMedia}
          onSelectMedia={(selected) => {
            onSave(selected);
            onClose();
          }}
        />
      </Form>
    </Modal>
  );
};

export default EditMap;
