import React, { FC, useEffect, useState } from "react";
import { Alert, Button, Card, Flex, Input, List, Tabs, Typography, Upload, message } from "antd";
import { CheckCircleOutlined, UploadOutlined } from "@ant-design/icons";
import { appConfigSchema, Config } from "@/types";
import { useGlobalState } from "@/state/globalState";
import { fr } from "@/lib/i18n";

const { TextArea } = Input;

export const EditConfig: FC = () => {
  const { config, setConfig, selectedProject } = useGlobalState();
  const [configJsonString, setConfigJsonString] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (config?.config) {
      setConfigJsonString(JSON.stringify(config.config, null, 2));
    }
  }, [config]);

  const handleSaveConfig = () => {
    setValidationError(null);
    setSaveSuccess(false);

    try {
      const parsed = JSON.parse(configJsonString);
      const valResult = appConfigSchema.safeParse(parsed);
      if (!valResult.success) {
        setValidationError(
          `Erreur de format de configuration : ${valResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`
        );
        return;
      }

      setConfig({
        projectId: config.projectId,
        config: parsed as Config,
      });
      setSaveSuccess(true);
      message.success(fr.config.saveSuccess);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : "JSON invalide");
    }
  };

  const sampleAssets = [
    { name: "vs-logo.svg", type: "Logo Vectoriel", path: "/brand_assets/vs-logo.svg" },
    { name: "logo.svg", type: "Logo Principal", path: "/assets/logo.svg" },
    { name: "intro.webm", type: "Transition Intro (Vertical)", path: "/intro_outro_wipes/intro.webm" },
    { name: "intro-16-9.webm", type: "Transition Intro (Horizontal)", path: "/intro_outro_wipes/intro-16-9.webm" },
    { name: "outro.webm", type: "Vignette Outro", path: "/intro_outro_wipes/outro.webm" },
    { name: "voice-sample.wav", type: "Clip Audio Voix Off", path: "/assets/voice-sample.wav" },
  ];

  return (
    <Card title={fr.config.panelTitle} className="w-full">
      <Tabs
        defaultActiveKey="json"
        items={[
          {
            key: "json",
            label: fr.config.jsonTab,
            children: (
              <Flex vertical gap="middle">
                <Typography.Paragraph type="secondary" className="text-xs">
                  {fr.config.description}
                </Typography.Paragraph>

                {validationError && (
                  <Alert type="error" message={validationError} showIcon />
                )}

                {saveSuccess && (
                  <Alert
                    type="success"
                    message="Configuration enregistrée sur le projet actif."
                    showIcon
                    icon={<CheckCircleOutlined />}
                  />
                )}

                <TextArea
                  rows={18}
                  value={configJsonString}
                  onChange={(e) => {
                    setConfigJsonString(e.target.value);
                    setSaveSuccess(false);
                    setValidationError(null);
                  }}
                  className="font-mono text-xs"
                />

                <Button type="primary" size="large" onClick={handleSaveConfig}>
                  {fr.config.validateAndSave}
                </Button>
              </Flex>
            ),
          },
          {
            key: "assets",
            label: fr.config.assetsTab,
            children: (
              <Flex vertical gap="middle">
                <Flex justify="space-between" align="center">
                  <Typography.Text strong>{fr.config.installedAssets}</Typography.Text>
                  <Upload
                    beforeUpload={(file) => {
                      message.success(`${file.name} : ${fr.config.assetUploaded}`);
                      return false;
                    }}
                    showUploadList={false}
                  >
                    <Button icon={<UploadOutlined />} size="small">
                      {fr.config.uploadAsset}
                    </Button>
                  </Upload>
                </Flex>

                <List
                  size="small"
                  bordered
                  dataSource={sampleAssets}
                  renderItem={(item) => (
                    <List.Item
                      actions={[
                        <Button
                          key="preview"
                          size="small"
                          type="link"
                          onClick={() => window.open(item.path, "_blank")}
                        >
                          Voir
                        </Button>,
                      ]}
                    >
                      <List.Item.Meta
                        title={<span className="font-mono text-xs">{item.name}</span>}
                        description={<span className="text-xs text-gray-400">{item.type}</span>}
                      />
                    </List.Item>
                  )}
                />
              </Flex>
            ),
          },
        ]}
      />
    </Card>
  );
};

export default EditConfig;
