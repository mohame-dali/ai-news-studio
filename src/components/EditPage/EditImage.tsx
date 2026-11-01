import React, { useMemo, useState } from "react";
import { ImageType, MediaAssetType } from "@/types";
import { Button, Form, Input, Modal, Upload, message } from "antd";
import ReactCrop, { Crop, PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { UploadOutlined } from "@ant-design/icons";
import ReplaceMedia from "./ReplaceMedia";
import { fr } from "@/lib/i18n";

interface Props {
  image?: ImageType;
  onClose: () => void;
  onSave: (asset: MediaAssetType) => void;
  alternativeMedia?: MediaAssetType[];
}

export const EditImage: React.FC<Props> = ({
  image,
  onClose,
  onSave,
  alternativeMedia = [],
}) => {
  const [form] = Form.useForm();
  const [crop, setCrop] = useState<Crop>({
    unit: "%",
    x: (image?.hotspot?.x_norm ?? 0.1) * 100,
    y: (image?.hotspot?.y_norm ?? 0.1) * 100,
    width: (image?.hotspot?.width_norm ?? 0.8) * 100,
    height: (image?.hotspot?.height_norm ?? 0.8) * 100,
  });

  const [imageUrl, setImageUrl] = useState(
    image?.url ||
      "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=1200&q=80"
  );

  const initialValues = useMemo(
    () => ({
      url: imageUrl,
      byline: image?.byline || "",
      description: image?.description || "",
    }),
    [image, imageUrl]
  );

  const handleFinish = (values: { url: string; byline?: string; description?: string }) => {
    const normX = (crop.x || 0) / 100;
    const normY = (crop.y || 0) / 100;
    const normW = (crop.width || 100) / 100;
    const normH = (crop.height || 100) / 100;

    const updatedImage: ImageType = {
      type: "image",
      url: values.url || imageUrl,
      byline: values.byline,
      description: values.description,
      imageAsset: {
        id: image?.imageAsset?.id || `img-${Date.now()}`,
        size: image?.imageAsset?.size || { width: 1200, height: 800 },
      },
      hotspot: {
        x: Math.round(normX * 1200),
        y: Math.round(normY * 800),
        width: Math.round(normW * 1200),
        height: Math.round(normH * 800),
        x_norm: normX,
        y_norm: normY,
        width_norm: normW,
        height_norm: normH,
      },
    };

    onSave(updatedImage);
    onClose();
  };

  const handleUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImageUrl(result);
      form.setFieldValue("url", result);
      message.success(`${file.name} chargé`);
    };
    reader.readAsDataURL(file);
    return false; // prevent upload post
  };

  return (
    <Modal
      open
      title={fr.media.editImageTitle}
      onCancel={onClose}
      onOk={() => form.submit()}
      width={720}
      okText={fr.media.saveChanges}
      cancelText={fr.editor.cancel}
    >
      <Form form={form} layout="vertical" initialValues={initialValues} onFinish={handleFinish}>
        <div className="flex flex-col items-center justify-center p-3 bg-gray-100 dark:bg-gray-800 rounded-lg mb-4 overflow-hidden max-h-[380px]">
          <ReactCrop
            crop={crop}
            onChange={(c: PixelCrop, percentCrop: Crop) => setCrop(percentCrop)}
            aspect={undefined}
          >
            <img
              src={imageUrl}
              alt="Crop preview"
              className="max-h-[340px] w-auto object-contain select-none"
            />
          </ReactCrop>
          <div className="text-[11px] text-gray-500 mt-2">
            {fr.media.focalHint}
          </div>
        </div>

        <div className="flex gap-2 items-center mb-4">
          <Upload beforeUpload={handleUpload} showUploadList={false}>
            <Button icon={<UploadOutlined />}>{fr.media.uploadNewImage}</Button>
          </Upload>
        </div>

        <Form.Item name="url" label={fr.media.imageUrl} rules={[{ required: true }]}>
          <Input onChange={(e) => setImageUrl(e.target.value)} />
        </Form.Item>

        <Form.Item name="byline" label={fr.media.byline}>
          <Input placeholder="Ex : Agence France-Presse (AFP) / Photo Jean Dupont" />
        </Form.Item>

        <Form.Item name="description" label={fr.media.description}>
          <Input placeholder="Brève description de la photographie" />
        </Form.Item>

        <ReplaceMedia
          alternativeMedia={alternativeMedia}
          onSelectMedia={(selected) => {
            if (selected.type === "image") {
              setImageUrl(selected.url);
              form.setFieldsValue({
                url: selected.url,
                byline: selected.byline,
                description: selected.description,
              });
            } else {
              onSave(selected);
              onClose();
            }
          }}
        />
      </Form>
    </Modal>
  );
};

export default EditImage;
