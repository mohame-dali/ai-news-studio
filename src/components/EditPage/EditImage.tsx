import React, { useMemo, useRef, useState } from "react";
import { BlurRegion, ImageType, MediaAssetType } from "@/types";
import { Alert, Button, Form, Input, Modal, Space, Tag, Tooltip, Upload, message } from "antd";
import ReactCrop, { Crop, PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import {
  ClearOutlined,
  DeleteOutlined,
  EyeInvisibleOutlined,
  ScissorOutlined,
  UploadOutlined,
} from "@ant-design/icons";
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
  const [activeTool, setActiveTool] = useState<"crop" | "blur">("crop");
  const [blurRegions, setBlurRegions] = useState<BlurRegion[]>(image?.blurRegions || []);
  const [isDrawingBlur, setIsDrawingBlur] = useState(false);
  const [blurStart, setBlurStart] = useState<{ x: number; y: number } | null>(null);
  const [currentBlur, setCurrentBlur] = useState<BlurRegion | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

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

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool !== "blur" || !imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setIsDrawingBlur(true);
    setBlurStart({ x, y });
    setCurrentBlur({ x, y, w: 0, h: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawingBlur || !blurStart || !imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const curX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const curY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    const x = Math.min(blurStart.x, curX);
    const y = Math.min(blurStart.y, curY);
    const w = Math.abs(curX - blurStart.x);
    const h = Math.abs(curY - blurStart.y);
    setCurrentBlur({ x, y, w, h });
  };

  const handleMouseUp = () => {
    if (!isDrawingBlur) return;
    setIsDrawingBlur(false);
    if (currentBlur && currentBlur.w > 0.015 && currentBlur.h > 0.015) {
      setBlurRegions((prev) => [...prev, currentBlur]);
      message.success("Zone de floutage appliquée (visage/plaque protégé)");
    }
    setBlurStart(null);
    setCurrentBlur(null);
  };

  const removeBlurRegion = (index: number) => {
    setBlurRegions((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAllBlurs = () => {
    setBlurRegions([]);
    message.info("Toutes les zones de floutage ont été effacées.");
  };

  const handleFinish = (values: { url: string; byline?: string; description?: string }) => {
    const normX = (crop.x || 0) / 100;
    const normY = (crop.y || 0) / 100;
    const normW = (crop.width || 100) / 100;
    const normH = (crop.height || 100) / 100;

    const updatedImage: ImageType = {
      type: "image",
      url: values.url || imageUrl,
      byline: values.byline,
      author: image?.author,
      description: values.description,
      license: image?.license,
      licenseUrl: image?.licenseUrl,
      licenseValidated: image?.licenseValidated,
      source: image?.source,
      blurRegions: blurRegions.length > 0 ? blurRegions : undefined,
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
      width={740}
      okText={fr.media.saveChanges}
      cancelText={fr.editor.cancel}
    >
      <Form form={form} layout="vertical" initialValues={initialValues} onFinish={handleFinish}>
        {/* Tool selector buttons */}
        <div className="flex items-center justify-between mb-3 bg-gray-50 dark:bg-gray-800 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
          <Space>
            <Button
              type={activeTool === "crop" ? "primary" : "default"}
              size="small"
              icon={<ScissorOutlined />}
              onClick={() => setActiveTool("crop")}
            >
              Cadrage & Point focal
            </Button>
            <Button
              type={activeTool === "blur" ? "primary" : "default"}
              size="small"
              danger={activeTool === "blur"}
              icon={<EyeInvisibleOutlined />}
              onClick={() => setActiveTool("blur")}
            >
              Flouter une zone (Visages & Plaques)
            </Button>
          </Space>

          {blurRegions.length > 0 && (
            <Space>
              <Tag color="red">{blurRegions.length} zone(s) floutée(s)</Tag>
              <Button size="small" type="text" danger icon={<ClearOutlined />} onClick={clearAllBlurs}>
                Effacer les flous
              </Button>
            </Space>
          )}
        </div>

        {activeTool === "blur" && (
          <Alert
            type="info"
            showIcon
            message="Mode Floutage Actif"
            description="Cliquez et glissez sur l'image pour tracer un rectangle sur un visage ou une plaque d'immatriculation. Le flou optique sera directement incrusté dans la vidéo."
            className="mb-3"
          />
        )}

        {/* Image preview with either ReactCrop or Blur Drawing Tool */}
        <div className="flex flex-col items-center justify-center p-3 bg-gray-100 dark:bg-gray-900 rounded-lg mb-4 overflow-hidden min-h-[300px] max-h-[420px]">
          {activeTool === "crop" ? (
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
          ) : (
            <div
              ref={imageContainerRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              className="relative cursor-crosshair select-none inline-block max-h-[340px] overflow-hidden"
              style={{ touchAction: "none" }}
            >
              <img
                src={imageUrl}
                alt="Blur tool preview"
                className="max-h-[340px] w-auto object-contain pointer-events-none"
                draggable={false}
              />

              {/* Existing blur zones */}
              {blurRegions.map((r, idx) => (
                <div
                  key={idx}
                  className="absolute border-2 border-dashed border-red-500 bg-red-500/20 backdrop-blur-md rounded transition-all group flex items-start justify-end p-0.5"
                  style={{
                    left: `${r.x * 100}%`,
                    top: `${r.y * 100}%`,
                    width: `${r.w * 100}%`,
                    height: `${r.h * 100}%`,
                  }}
                >
                  <Tooltip title="Supprimer ce floutage">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeBlurRegion(idx);
                      }}
                      className="bg-red-600 text-white rounded-full p-0.5 text-[9px] hover:bg-red-700 cursor-pointer shadow"
                    >
                      ✕
                    </button>
                  </Tooltip>
                </div>
              ))}

              {/* Current drawing blur preview */}
              {isDrawingBlur && currentBlur && (
                <div
                  className="absolute border-2 border-dashed border-yellow-400 bg-yellow-400/20 backdrop-blur-sm pointer-events-none rounded"
                  style={{
                    left: `${currentBlur.x * 100}%`,
                    top: `${currentBlur.y * 100}%`,
                    width: `${currentBlur.w * 100}%`,
                    height: `${currentBlur.h * 100}%`,
                  }}
                />
              )}
            </div>
          )}

          <div className="text-[11px] text-gray-500 mt-2">
            {activeTool === "crop" ? fr.media.focalHint : "Tracez une boîte sur l'image pour anonymiser les personnes ou véhicules."}
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
          currentMedia={image}
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
