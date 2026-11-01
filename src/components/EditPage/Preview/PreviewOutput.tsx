import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProcessedManuscript, Tab } from "@/types";
import { processManuscriptLocally } from "@/lib/manuscriptProcessor";
import VideofyPlayer from "../../Player/VideofyPlayer";
import ErrorCard from "./ErrorCard";
import LoadingCard from "./LoadingCard";
import { useGlobalState } from "@/state/globalState";
import { DesktopOutlined, MobileOutlined, DownloadOutlined, SyncOutlined } from "@ant-design/icons";
import { Button, Segmented, Tooltip, message } from "antd";
import DownloadModal from "./DownloadModal";
import { updateGenerationData } from "@/lib/storage";
import { fr } from "@/lib/i18n";

interface Props {
  tabs: Tab[];
}

export const PreviewOutput: React.FC<Props> = ({ tabs }) => {
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<"Vertical" | "Horizontal">("Vertical");
  const [downloadOpen, setDownloadOpen] = useState(false);

  const {
    config: { config },
    processedManuscripts,
    setProcessedManuscripts,
    generationId,
  } = useGlobalState();

  const fetchData = useCallback(
    async (isUpdate = false) => {
      if (!tabs || tabs.length === 0 || !config) return;

      try {
        if (isUpdate) setUpdating(true);
        else setLoading(true);

        const results: ProcessedManuscript[] = await Promise.all(
          tabs.map((tab) => processManuscriptLocally(tab.manuscript, config))
        );

        setError(null);
        setProcessedManuscripts(results);
      } catch (err) {
        console.error("Preview processing error:", err);
        setError(err instanceof Error ? err.message : "Erreur de génération de la prévisualisation");
      } finally {
        setLoading(false);
        setUpdating(false);
      }
    },
    [tabs, config, setProcessedManuscripts]
  );

  const updatePreview = async () => {
    await fetchData(true);
    if (generationId) {
      updateGenerationData(generationId, tabs);
      message.success(fr.preview.updatedAndSaved);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const playerConfig = useMemo(
    () => ({
      ...(config?.player || {}),
      assetBaseUrl: typeof window !== "undefined" ? window.location.origin : "",
    }),
    [config?.player]
  );

  return (
    <div className="sticky top-4 flex flex-col items-center w-full max-w-[480px] mx-auto">
      {error && !updating && !loading ? (
        <ErrorCard errorMessage={error} onRetry={() => fetchData()} />
      ) : !processedManuscripts.length && (updating || loading) ? (
        <LoadingCard />
      ) : (
        <div className="relative w-full">
          <VideofyPlayer
            height={previewType === "Vertical" ? 1920 : 1080}
            width={previewType === "Vertical" ? 1080 : 1920}
            manuscripts={processedManuscripts}
            playerConfig={playerConfig}
            style={{
              maxHeight: previewType === "Vertical" ? "75vh" : "50vh",
              width: "100%",
              aspectRatio: previewType === "Vertical" ? "9/16" : "16/9",
            }}
          />

          {(loading || updating) && (
            <div className="z-30 absolute inset-0 flex justify-center items-center bg-black/60 backdrop-blur-xs rounded-xl">
              <span className="font-semibold text-white text-sm bg-black/70 px-4 py-2 rounded-full border border-white/20">
                {fr.preview.updating}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Control bar beneath preview */}
      <div className="flex flex-wrap items-center justify-center gap-2 mt-4 w-full">
        <Tooltip title="Basculer l'orientation : Format Vertical (9:16) ou Horizontal (16:9)">
          <Segmented
            options={[
              { value: "Vertical", icon: <MobileOutlined />, label: fr.preview.vertical },
              { value: "Horizontal", icon: <DesktopOutlined />, label: fr.preview.horizontal },
            ]}
            value={previewType}
            onChange={(value) => setPreviewType(value as "Vertical" | "Horizontal")}
          />
        </Tooltip>

        <Button
          onClick={updatePreview}
          disabled={loading || updating}
          type="default"
          icon={<SyncOutlined spin={updating} />}
        >
          {fr.editor.update}
        </Button>

        <Button
          disabled={loading || updating || !!error || !processedManuscripts.length}
          type="primary"
          icon={<DownloadOutlined />}
          onClick={() => {
            updatePreview();
            setDownloadOpen(true);
          }}
        >
          {fr.editor.download}
        </Button>
      </div>

      <DownloadModal open={downloadOpen} setOpen={setDownloadOpen} />
    </div>
  );
};

export default memo(PreviewOutput);
