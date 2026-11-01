import React, { FC, useMemo, useRef, useState } from "react";
import { MediaAssetType, VideoType } from "@/types";
import { Button, Form, Input, InputNumber, Modal, Space } from "antd";
import ReplaceMedia from "./ReplaceMedia";
import { fr } from "@/lib/i18n";

interface Props {
  video?: VideoType;
  onClose: () => void;
  onSave: (asset: MediaAssetType) => void;
  alternativeMedia?: MediaAssetType[];
}

export const EditVideo: FC<Props> = ({
  video,
  onClose,
  onSave,
  alternativeMedia = [],
}) => {
  const [form] = Form.useForm();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoDuration, setVideoDuration] = useState(video?.videoAsset?.duration || 15);
  const [videoUrl, setVideoUrl] = useState(
    video?.url ||
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
  );

  const initialValues = useMemo(
    () => ({
      url: videoUrl,
      startFrom: video?.startFrom ?? 0,
      endAt: video?.endAt ?? Math.min(10, videoDuration),
      byline: video?.byline || "",
      description: video?.description || "",
    }),
    [video, videoUrl, videoDuration]
  );

  const handleFinish = (values: {
    url: string;
    startFrom: number;
    endAt: number;
    byline?: string;
    description?: string;
  }) => {
    const updatedVideo: VideoType = {
      type: "video",
      url: values.url || videoUrl,
      startFrom: Number(values.startFrom) || 0,
      endAt: Number(values.endAt) || 10,
      byline: values.byline,
      description: values.description,
      videoAsset: {
        id: video?.videoAsset?.id || `video-${Date.now()}`,
        title: values.description || video?.videoAsset?.title || "Extrait Vidéo",
        duration: videoDuration,
        streamUrls: {
          mp4: values.url || videoUrl,
        },
      },
    };

    onSave(updatedVideo);
    onClose();
  };

  return (
    <Modal
      open
      title={fr.media.editVideoTitle}
      onCancel={onClose}
      onOk={() => form.submit()}
      width={680}
      okText={fr.media.saveChanges}
      cancelText={fr.editor.cancel}
    >
      <Form form={form} layout="vertical" initialValues={initialValues} onFinish={handleFinish}>
        <div className="bg-black rounded-lg overflow-hidden mb-4 flex justify-center max-h-[320px]">
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            className="w-full max-h-[300px] object-contain"
            onLoadedMetadata={(e) => {
              const dur = (e.target as HTMLVideoElement).duration;
              if (Number.isFinite(dur)) {
                setVideoDuration(dur);
              }
            }}
          />
        </div>

        <Form.Item name="url" label={fr.media.videoUrl} rules={[{ required: true }]}>
          <Input onChange={(e) => setVideoUrl(e.target.value)} />
        </Form.Item>

        <Space className="w-full flex" size="large">
          <Form.Item name="startFrom" label={fr.media.startTime}>
            <InputNumber
              min={0}
              max={videoDuration}
              step={0.5}
              onChange={(val) => {
                if (videoRef.current && val !== null) {
                  videoRef.current.currentTime = Number(val);
                }
              }}
            />
          </Form.Item>

          <Form.Item name="endAt" label={fr.media.endTime}>
            <InputNumber min={0.5} max={videoDuration || 60} step={0.5} />
          </Form.Item>

          <div className="pt-7 text-xs text-gray-500">
            {fr.media.totalDuration} {videoDuration.toFixed(1)}s
          </div>
        </Space>

        <Form.Item name="byline" label={fr.media.byline}>
          <Input placeholder="Ex : Reuters Vidéo / Archives AFP" />
        </Form.Item>

        <Form.Item name="description" label={fr.media.description}>
          <Input placeholder="Brève description de la séquence vidéo" />
        </Form.Item>

        <ReplaceMedia
          alternativeMedia={alternativeMedia}
          onSelectMedia={(selected) => {
            if (selected.type === "video") {
              setVideoUrl(selected.url);
              form.setFieldsValue({
                url: selected.url,
                byline: selected.byline,
                description: selected.description,
                startFrom: selected.startFrom ?? 0,
                endAt: selected.endAt ?? 6,
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

export default EditVideo;
