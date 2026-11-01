import React, { FC, useState } from "react";
import { Alert, Button, Form, Input, Modal, Radio, Switch, Typography, message } from "antd";
import { DownloadOutlined, LoadingOutlined } from "@ant-design/icons";
import { useGlobalState } from "@/state/globalState";
import { fr } from "@/lib/i18n";

const videoTypes = [
  {
    name: "Vertical",
    label: "Format Vertical (9:16)",
    description: "Vidéo verticale (1080×1920) optimisée pour TikTok, YouTube Shorts et Reels",
  },
  {
    name: "Horizontal",
    label: "Format Horizontal (16:9)",
    description: "Vidéo horizontale (1920×1080) pour diffusion Web, TV et YouTube",
  },
  {
    name: "Piste audio seule",
    label: "Voix off seule",
    description: "Piste audio de narration seule (.wav / .mp3)",
  },
  {
    name: "Projet AI News Studio",
    label: "Archive de projet",
    description: "Fichier de projet complet et rééditable (.json)",
  },
];

interface Props {
  open: boolean;
  setOpen: (open: boolean) => void;
}

type FormType = {
  exportType: string;
  logo: boolean;
  audio: boolean;
  voice: boolean;
  music: boolean;
  title: string;
};

export const DownloadModal: FC<Props> = ({ open, setOpen }) => {
  const { tabs, processedManuscripts, config } = useGlobalState();
  const [downloadForm] = Form.useForm<FormType>();
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const downloadAsJsonProject = (title: string) => {
    const data = {
      config: config.config,
      manuscripts: tabs.map(({ manuscript }) => manuscript),
      articleUrls: tabs.map(({ articleUrl }) => articleUrl),
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const currentTime = new Date().toISOString().replace(/[:.]/g, "-");
    a.href = url;
    a.download = `${title || "projet-ai-news-studio"}-${currentTime}.json`;
    a.click();
    URL.revokeObjectURL(url);
    message.success("Fichier projet JSON téléchargé avec succès");
    setOpen(false);
  };

  const downloadAudio = (title: string) => {
    const firstAudioSrc =
      processedManuscripts[0]?.meta?.audio?.src || "/assets/voice-sample.wav";

    const a = document.createElement("a");
    a.href = firstAudioSrc;
    a.download = `${title || "narration-voix"}.wav`;
    a.click();
    message.success("Piste audio de narration téléchargée");
    setOpen(false);
  };

  const handleDownload = async (values: FormType) => {
    setIsProcessing(true);
    setDownloadUrl(null);

    try {
      if (values.exportType === "Projet AI News Studio") {
        downloadAsJsonProject(values.title);
        return;
      }

      if (values.exportType === "Piste audio seule") {
        downloadAudio(values.title);
        return;
      }

      // Simulate rendering pipeline
      await new Promise((res) => setTimeout(res, 1200));

      // Create a downloadable sample MP4 or WebM video link
      const simulatedVideoUrl =
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
      setDownloadUrl(simulatedVideoUrl);

      // Trigger download
      const a = document.createElement("a");
      a.href = simulatedVideoUrl;
      a.target = "_blank";
      a.rel = "noreferrer";
      a.download = `${values.title || "video-actualite"}-${values.exportType.toLowerCase()}.mp4`;
      a.click();

      message.success(fr.download.renderSuccess);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Erreur lors du téléchargement");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={() => setOpen(false)}
      footer={null}
      width={560}
      title={<Typography.Title level={3} style={{ margin: 0 }}>{fr.download.modalTitle}</Typography.Title>}
    >
      <Form<FormType>
        form={downloadForm}
        onFinish={handleDownload}
        layout="vertical"
        initialValues={{
          title: processedManuscripts[0]?.meta?.title || "sujet-actualite",
          exportType: "Vertical",
          logo: true,
          audio: true,
          voice: true,
          music: true,
        }}
      >
        <Form.Item name="title" label={fr.download.filenameLabel} rules={[{ required: true }]}>
          <Input placeholder="nom-fichier-export" />
        </Form.Item>

        <Form.Item name="exportType" label={fr.download.formatLabel}>
          <Radio.Group className="w-full flex flex-col gap-2">
            {videoTypes.map((t) => (
              <Radio key={t.name} value={t.name} className="p-2 rounded border border-gray-100 hover:border-blue-400">
                <div className="font-semibold text-sm">{t.label}</div>
                <div className="text-xs text-gray-500">{t.description}</div>
              </Radio>
            ))}
          </Radio.Group>
        </Form.Item>

        <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg mb-4">
          <Form.Item name="logo" label={fr.download.includeLogo} valuePropName="checked" className="mb-0">
            <Switch />
          </Form.Item>
          <Form.Item name="audio" label={fr.download.masterAudio} valuePropName="checked" className="mb-0">
            <Switch />
          </Form.Item>
          <Form.Item name="voice" label={fr.download.voiceover} valuePropName="checked" className="mb-0">
            <Switch />
          </Form.Item>
          <Form.Item name="music" label={fr.download.backgroundMusic} valuePropName="checked" className="mb-0">
            <Switch />
          </Form.Item>
        </div>

        {downloadUrl && (
          <Alert
            type="success"
            message={fr.download.renderSuccess}
            description={
              <a href={downloadUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline text-xs">
                {fr.download.manualDownloadLink}
              </a>
            }
            className="mb-4"
          />
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={() => setOpen(false)}>{fr.editor.cancel}</Button>
          <Button
            type="primary"
            htmlType="submit"
            size="large"
            loading={isProcessing}
            icon={isProcessing ? <LoadingOutlined /> : <DownloadOutlined />}
          >
            {isProcessing ? fr.download.renderingInProgress : fr.download.downloadVideo}
          </Button>
        </div>
      </Form>
    </Modal>
  );
};

export default DownloadModal;
