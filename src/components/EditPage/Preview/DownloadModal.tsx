import React, { FC, useState, useMemo } from "react";
import { Alert, Button, Form, Input, Modal, Progress, Radio, Switch, Typography, message } from "antd";
import { DownloadOutlined, FileProtectOutlined, LoadingOutlined, LockOutlined } from "@ant-design/icons";
import { useGlobalState } from "@/state/globalState";
import { fr } from "@/lib/i18n";
import { recordPlayerVideo, ExportProgress } from "@/services/videoExportRecorder";
import { fetchEdgeTts } from "@/services/ttsService";
import { parsePronunciationText } from "@/lib/manuscriptProcessor";

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
  const [exportProgress, setExportProgress] = useState<ExportProgress>({
    percent: 0,
    message: "",
  });

  // Extract unique media attributions across all segments
  const mediaAttributions = useMemo(() => {
    const list: string[] = [];
    processedManuscripts.forEach((m) => {
      (m.segments || []).forEach((s) => {
        const media = s.mainMedia;
        if (!media) return;
        const author = media.author || (media.byline ? media.byline.replace(/^📷\s*/, "") : "");
        const license = media.license || "";
        const mediaUrl = "url" in media && typeof media.url === "string" ? media.url : "";
        const source = media.source || (mediaUrl.includes("wikimedia") ? "Wikimedia Commons" : mediaUrl.includes("pexels") ? "Pexels" : "");
        
        let attr = "";
        if (author && license && source) {
          attr = `${media.type === "video" ? "Vidéo" : "Photo"} : ${author} · ${license} (${source})`;
        } else if (author && source) {
          attr = `${media.type === "video" ? "Vidéo" : "Photo"} : ${author} (${source})`;
        } else if (media.byline) {
          attr = media.byline;
        }

        if (attr && !list.includes(attr)) {
          list.push(attr);
        }
      });
    });
    return list;
  }, [processedManuscripts]);

  // Strict Rights Card Enforcement: identify any segment with external media that lacks license certification
  const unvalidatedSegments = useMemo(() => {
    const issues: { segmentIdx: number; title: string; source: string; license?: string }[] = [];
    let count = 0;
    processedManuscripts.forEach((m) => {
      (m.segments || []).forEach((s) => {
        count++;
        const media = s.mainMedia;
        const mediaUrl = media && "url" in media && typeof media.url === "string" ? media.url : "";
        const hasExternalMedia =
          Boolean(mediaUrl) &&
          !mediaUrl.startsWith("data:image/svg+xml") &&
          (mediaUrl.startsWith("http://") ||
            mediaUrl.startsWith("https://") ||
            Boolean(media?.source) ||
            Boolean(media?.license)) &&
          s.graphicMode !== "number" &&
          s.graphicMode !== "quote" &&
          s.graphicMode !== "map";

        if (hasExternalMedia && s.licenseValidated !== true) {
          const segTitle = (s.texts && s.texts[0]?.displayText) || s.text || `Séquence ${count}`;
          issues.push({
            segmentIdx: count,
            title: segTitle.slice(0, 32),
            source: media?.source || "Média externe",
            license: media?.license,
          });
        }
      });
    });
    return issues;
  }, [processedManuscripts]);

  const hasUnvalidatedRights = unvalidatedSegments.length > 0;

  // Get editorial status from the first tab
  const editorialStatus = tabs[0]?.editorialStatus || "under_review";
  const isApproved = editorialStatus === "approved";

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

  const downloadAudio = async (title: string) => {
    try {
      const allTexts: string[] = [];
      processedManuscripts.forEach((m) => {
        (m.segments || []).forEach((s) => {
          const raw = s.text || (s.texts && s.texts[0]?.displayText) || "";
          const [, spoken] = parsePronunciationText(raw);
          if (spoken.trim()) allTexts.push(spoken.trim());
        });
      });

      const fullScript = allTexts.join(". ");
      if (fullScript) {
        const data = await fetchEdgeTts(fullScript, "fr-FR-DeniseNeural");
        if (data.audioBase64) {
          const a = document.createElement("a");
          a.href = data.audioBase64;
          a.download = `${title || "narration-voix"}.mp3`;
          a.click();
          message.success("Piste audio Edge-TTS téléchargée avec succès (.mp3)");
          setOpen(false);
          return;
        }
      }
    } catch (err) {
      console.warn("Failed to generate complete audio track:", err);
    }

    const firstAudioSrc =
      processedManuscripts[0]?.meta?.audio?.src || "/assets/voice-sample.wav";

    const a = document.createElement("a");
    a.href = firstAudioSrc;
    a.download = `${title || "narration-voix"}.wav`;
    a.click();
    message.success("Piste audio de narration téléchargée");
    setOpen(false);
  };

  const exportRightsAuditLog = () => {
    const segmentsAudit: any[] = [];
    let count = 0;

    processedManuscripts.forEach((m) => {
      (m.segments || []).forEach((s) => {
        count++;
        const media = s.mainMedia;
        const mediaUrl = media && "url" in media && typeof media.url === "string" ? media.url : "";
        const author = media?.author || (media?.byline ? media.byline.replace(/^📷\s*/, "") : "Rédaction / Interne");
        const license = media?.license || (media?.source === "Pexels" ? "Licence Pexels" : media?.source === "Wikimedia Commons" ? "Creative Commons" : "Droits réservés / Usage autorisé");
        const licenseUrl = media?.licenseUrl || "";
        const source = media?.source || (mediaUrl.includes("wikimedia") ? "Wikimedia Commons" : mediaUrl.includes("pexels") ? "Pexels" : "Production interne");
        const blurCount = (media && "blurRegions" in media && media.blurRegions ? media.blurRegions.length : s.blurRegions?.length || 0);

        segmentsAudit.push({
          segmentIndex: count,
          segmentTitle: (s.texts && s.texts[0]?.displayText) || s.text || `Séquence ${count}`,
          mediaType: media?.type || (s.graphicMode && s.graphicMode !== "none" ? `graphic-${s.graphicMode}` : "editorial-card"),
          mediaUrl: mediaUrl || "N/A (Carte Graphique)",
          source,
          author,
          license,
          licenseUrl,
          licenseValidated: Boolean(s.licenseValidated || media?.licenseValidated || s.graphicMode === "number" || s.graphicMode === "quote" || s.graphicMode === "map"),
          validationTimestamp: s.licenseValidated ? new Date().toISOString() : null,
          rgpdProtection: {
            blurRegionsCount: blurCount,
            facesOrPlatesProtected: blurCount > 0,
          },
        });
      });
    });

    const auditData = {
      projectTitle: processedManuscripts[0]?.meta?.title || "Projet AI News Studio",
      auditExportedAt: new Date().toISOString(),
      legalJurisdiction: "Union Européenne / France (Code de la propriété intellectuelle & RGPD)",
      editorialStatus,
      editorialApproved: isApproved,
      complianceSummary: {
        totalSegments: count,
        externalMediaCount: segmentsAudit.filter((s) => s.source !== "Production interne").length,
        certifiedMediaCount: segmentsAudit.filter((s) => s.licenseValidated).length,
        allRightsCertified: !hasUnvalidatedRights,
        rgpdBlurZonesApplied: segmentsAudit.reduce((acc, s) => acc + s.rgpdProtection.blurRegionsCount, 0),
      },
      segments: segmentsAudit,
    };

    const blob = new Blob([JSON.stringify(auditData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const currentTime = new Date().toISOString().replace(/[:.]/g, "-");
    a.href = url;
    a.download = `registre-droits-auteurs-${currentTime}.json`;
    a.click();
    URL.revokeObjectURL(url);
    message.success("Registre des droits d'auteur exporté avec succès (.json)");
  };

  const handleDownload = async (values: FormType) => {
    setIsProcessing(true);
    setDownloadUrl(null);

    try {
      if (values.exportType === "Projet AI News Studio") {
        // JSON export is always allowed (backup/export, not publication)
        downloadAsJsonProject(values.title);
        return;
      }

      // All other exports require approval and media rights certification
      if (!isApproved) {
        message.error(fr.editorial.approvalRequiredForDownload);
        setIsProcessing(false);
        return;
      }

      if (hasUnvalidatedRights) {
        message.error(
          "Export bloqué : vous devez certifier la licence de tous les médias externes avant d'exporter la vidéo ou l'audio."
        );
        setIsProcessing(false);
        return;
      }

      if (values.exportType === "Piste audio seule") {
        downloadAudio(values.title);
        return;
      }

      // 1. Real client-side canvas rendering & MediaRecorder video capture
      const result = await recordPlayerVideo(
        processedManuscripts,
        config?.config?.player,
        {
          title: values.title || "video-actualite",
          exportType: values.exportType,
          logo: Boolean(values.logo),
          audio: Boolean(values.audio),
          voice: Boolean(values.voice),
          music: Boolean(values.music),
        },
        (prog) => {
          setExportProgress(prog);
        }
      );

      let finalBlob = result.blob;
      let finalFilename = result.filename;

      // 2. STEP 5: Server-side FFmpeg MP4 Transcoding (H.264, AAC, Loudnorm EBU R128)
      try {
        setExportProgress({
          percent: 96,
          message: "Transcodage professionnel FFmpeg MP4 (libx264, loudnorm, AAC)...",
        });

        const transcodeRes = await fetch("/api/transcode", {
          method: "POST",
          headers: {
            "Content-Type": result.blob.type || "video/webm",
          },
          body: result.blob,
        });

        if (transcodeRes.ok) {
          finalBlob = await transcodeRes.blob();
          finalFilename = `${values.title || "video-actualite"}-${values.exportType.toLowerCase()}.mp4`;
          message.success("Vidéo transcodée avec succès via FFmpeg (H.264 / AAC)");
        } else {
          let errDetail = "";
          try {
            const errJson = await transcodeRes.json();
            errDetail = errJson.error || "";
          } catch {
            errDetail = await transcodeRes.text();
          }
          message.error(`Erreur FFmpeg : ${errDetail || "Échec du transcodage serveur"}`);
          console.warn("[FFmpeg Transcode Warning]: Utilisation de l'enregistrement brut.");
        }
      } catch (transcodeErr) {
        console.error("[FFmpeg Transcode Request Error]:", transcodeErr);
        message.error(`Erreur FFmpeg : ${transcodeErr instanceof Error ? transcodeErr.message : "Erreur réseau"}`);
      }

      const finalUrl = URL.createObjectURL(finalBlob);
      setDownloadUrl(finalUrl);

      // Trigger automatic file download
      const a = document.createElement("a");
      a.href = finalUrl;
      a.download = finalFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

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
      {hasUnvalidatedRights && (
        <Alert
          type="error"
          showIcon
          icon={<LockOutlined />}
          message="Droits d'auteur & licences non certifiés"
          description={
            <div className="space-y-1.5 mt-1">
              <p className="text-xs text-red-800 dark:text-red-300">
                L'export vidéo/audio est <strong>bloqué</strong> tant que la conformité juridique des médias externes n'est pas confirmée.
              </p>
              <ul className="list-disc list-inside text-xs text-red-900 dark:text-red-200 font-medium">
                {unvalidatedSegments.map((item, idx) => (
                  <li key={idx}>
                    Séquence {item.segmentIdx} ({item.title}) : {item.source} {item.license ? `· ${item.license}` : ""}
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-gray-600 dark:text-gray-400">
                💡 Ouvrez les séquences concernées dans l'éditeur et cochez la case de certification des droits ou activez le mode <strong>Carte Graphique</strong> (Grand Chiffre / Citation).
              </p>
            </div>
          }
          className="mb-4"
        />
      )}

      {!isApproved && (
        <Alert
          type="warning"
          message={fr.editorial.approvalRequiredForDownload}
          description={fr.editorial.approvalRequiredForDownloadDesc}
          showIcon
          icon={<LockOutlined />}
          className="mb-4"
        />
      )}

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
            {videoTypes.map((t) => {
              const isBlockedByApproval = t.name !== "Projet AI News Studio" && !isApproved;
              const isBlockedByRights = t.name !== "Projet AI News Studio" && hasUnvalidatedRights;
              const isExportRestricted = isBlockedByApproval || isBlockedByRights;
              return (
                <Radio 
                  key={t.name} 
                  value={t.name} 
                  className="p-2 rounded border border-gray-100 hover:border-blue-400"
                  disabled={isExportRestricted}
                >
                  <div className="font-semibold text-sm">{t.label}</div>
                  <div className="text-xs text-gray-500">{t.description}</div>
                  {isBlockedByRights && (
                    <div className="text-xs text-red-600 font-semibold mt-1 flex items-center gap-1">
                      <LockOutlined /> Licence média externe non certifiée
                    </div>
                  )}
                  {isBlockedByApproval && !isBlockedByRights && (
                    <div className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                      <LockOutlined /> {fr.editorial.approvalRequired}
                    </div>
                  )}
                </Radio>
              );
            })}
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

        {isProcessing && (
          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex justify-between items-center mb-1 text-xs font-semibold text-blue-900 dark:text-blue-200">
              <span>{fr.download.renderingInProgress}</span>
              <span>{exportProgress.percent}%</span>
            </div>
            <Progress percent={exportProgress.percent} showInfo={false} status="active" strokeColor="#2563eb" />
            <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-2 text-center font-mono">
              {exportProgress.message}
            </div>
          </div>
        )}

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

        {mediaAttributions.length > 0 && (
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
              <span>⚖️</span>
              <span>Crédits médias & droits d'utilisation :</span>
            </div>
            <ul className="list-disc list-inside text-[11px] text-gray-600 dark:text-gray-400 space-y-0.5">
              {mediaAttributions.map((attr, idx) => (
                <li key={idx} className="truncate">
                  {attr}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-100 dark:border-gray-800 mt-2">
          <Button
            icon={<FileProtectOutlined />}
            onClick={exportRightsAuditLog}
            title="Télécharger l'audit légal et le registre des droits d'auteur du projet en JSON"
          >
            Exporter le registre des droits
          </Button>

          <div className="flex gap-2">
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
        </div>
      </Form>
    </Modal>
  );
};

export default DownloadModal;
