import React, { FC, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Flex,
  Form,
  Input,
  Select,
  Typography,
  message,
} from "antd";
import { LoadingOutlined, PlayCircleOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { defaultBrands, defaultFetchers, buildDefaultConfig } from "@/lib/constants";
import { generateManuscriptFromInput } from "@/lib/articleGenerator";
import { useGlobalState } from "@/state/globalState";
import { getProjectList, saveGeneration, GenerationRecord } from "@/lib/storage";
import { fr } from "@/lib/i18n";

const { Title, Paragraph } = Typography;

type FormType = {
  fetcherId: string;
  brandId: string;
  prompt: string;
  inputs: Record<string, string>;
};

interface Props {
  onNavigateToEditor: (generationId: string) => void;
}

export const StartPage: FC<Props> = ({ onNavigateToEditor }) => {
  const [form] = Form.useForm<FormType>();
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(fr.start.generating);
  const [recentProjects, setRecentProjects] = useState<{ id: string; name: string }[]>([]);

  const {
    setConfig,
    setCustomPrompt,
    setTabs,
    setCurrentTabIndex,
    setGenerationId,
    setSelectedProject,
  } = useGlobalState();

  const selectedFetcherId = Form.useWatch("fetcherId", form) || defaultFetchers[0].id;
  const selectedBrandId = Form.useWatch("brandId", form) || defaultBrands[0].id;

  const selectedFetcher = useMemo(
    () => defaultFetchers.find((f) => f.id === selectedFetcherId),
    [selectedFetcherId]
  );

  const selectedBrand = useMemo(
    () => defaultBrands.find((b) => b.id === selectedBrandId),
    [selectedBrandId]
  );

  const lastSyncedBrandId = useRef<string | undefined>(undefined);

  useEffect(() => {
    setRecentProjects(getProjectList());
  }, []);

  useEffect(() => {
    if (!form.getFieldValue("fetcherId")) {
      form.setFieldsValue({
        fetcherId: defaultFetchers[0].id,
        brandId: defaultBrands[0].id,
        prompt: defaultBrands[0].scriptPrompt,
        inputs: {},
      });
    }
  }, [form]);

  useEffect(() => {
    if (selectedBrandId && lastSyncedBrandId.current !== selectedBrandId) {
      const brand = defaultBrands.find((b) => b.id === selectedBrandId);
      if (brand) {
        form.setFieldValue("prompt", brand.scriptPrompt);
      }
      lastSyncedBrandId.current = selectedBrandId;
    }
  }, [selectedBrandId, form]);

  const loadManuscript = async (values: FormType) => {
    const { fetcherId, brandId, prompt } = values;
    const brand = defaultBrands.find((b) => b.id === brandId) || defaultBrands[0];

    setLoading(true);
    setLoadingMessage(fr.start.fetchingArticle);

    try {
      setLoadingMessage(fr.start.applyingBrand);
      await new Promise((res) => setTimeout(res, 300));

      const baseConfig = buildDefaultConfig(brand.id);
      if (brand.config?.player) {
        baseConfig.player = {
          ...baseConfig.player,
          ...brand.config.player,
        };
      }
      baseConfig.manuscript.script_prompt = prompt || baseConfig.manuscript.script_prompt;

      setLoadingMessage(fr.start.generatingManuscript);
      const result = await generateManuscriptFromInput(
        fetcherId,
        values.inputs || {},
        baseConfig
      );

      const cleanedManuscript = {
        ...result.manuscript,
        meta: {
          ...result.manuscript.meta,
          articleUrl: result.projectId,
          uniqueId: `tab-${result.projectId}-${Date.now()}`,
        },
      };

      const tabsData = [
        {
          articleUrl: result.projectId,
          projectId: result.projectId,
          manuscript: cleanedManuscript,
          editorialStatus: "script_generated" as const,
          originalArticle: result.sourceArticle,
          originalScriptSnapshot: cleanedManuscript.segments.map((s) => s.text || ""),
          revisions: [
            {
              timestamp: new Date().toISOString(),
              status: "script_generated" as const,
              note: "Génération initiale du script d'actualité",
              snapshotTexts: cleanedManuscript.segments.map((s) => s.text || ""),
            },
          ],
        },
      ];

      const projectOption = {
        id: result.projectId,
        name: cleanedManuscript.meta.title,
      };

      // Save to storage
      const generationRecord: GenerationRecord = {
        id: result.projectId,
        projectId: result.projectId,
        brandId: brand.id,
        config: baseConfig,
        project: projectOption,
        data: tabsData,
        editorialStatus: "script_generated",
        originalArticle: result.sourceArticle,
        createdDate: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      saveGeneration(generationRecord);

      // Update global state
      setConfig({ projectId: result.projectId, config: baseConfig });
      setTabs(tabsData);
      setCustomPrompt(prompt);
      setCurrentTabIndex(0);
      setGenerationId(result.projectId);
      setSelectedProject(projectOption);

      message.success("Sujet vidéo généré avec succès !");
      onNavigateToEditor(result.projectId);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Erreur de génération du sujet vidéo");
    } finally {
      setLoading(false);
      setLoadingMessage(fr.start.generating);
    }
  };

  return (
    <Flex vertical align="center" className="mt-8 mb-16 px-4">
      {/* Brand Header */}
      <div className="text-center max-w-2xl mb-8">
        <Title
          style={{
            fontSize: "3.25rem",
            marginBottom: "0.5rem",
            fontWeight: 800,
            letterSpacing: "-0.04em",
          }}
          className="text-blue-600"
        >
          {fr.start.heroTitle}
        </Title>
        <Paragraph className="text-lg text-gray-600 dark:text-gray-400">
          {fr.start.heroSubtitle}
        </Paragraph>
      </div>

      <Card
        className="w-full max-w-[80ch] shadow-xl border-gray-200 dark:border-gray-800"
        styles={{ body: { padding: "2rem" } }}
      >
        <Form form={form} onFinish={loadManuscript} layout="vertical">
          {/* Fetcher Selection */}
          <Form.Item name="fetcherId" label={fr.start.fetcherLabel} rules={[{ required: true }]}>
            <Select
              size="large"
              options={defaultFetchers.map((fetcher) => ({
                value: fetcher.id,
                label: fetcher.title,
              }))}
            />
          </Form.Item>

          {selectedFetcher?.description && (
            <Paragraph type="secondary" style={{ marginTop: -10, marginBottom: 16 }}>
              {selectedFetcher.description}
            </Paragraph>
          )}

          {/* Dynamic input fields based on fetcher */}
          {(selectedFetcher?.fields || [])
            .filter((field) => field.name !== "project_id")
            .map((field) => (
              <Form.Item
                key={field.name}
                name={["inputs", field.name]}
                label={field.label}
                rules={
                  field.required
                    ? [{ required: true, message: `Le champ ${field.label} est requis` }]
                    : undefined
                }
              >
                {field.name === "body" ? (
                  <Input.TextArea rows={4} placeholder={field.placeholder} />
                ) : (
                  <Input size="large" placeholder={field.placeholder} />
                )}
              </Form.Item>
            ))}

          {/* Brand Selection */}
          <Form.Item name="brandId" label={fr.start.brandLabel} rules={[{ required: true }]}>
            <Select
              size="large"
              options={defaultBrands.map((brand) => ({
                value: brand.id,
                label: brand.brandName,
              }))}
            />
          </Form.Item>

          {/* Custom Prompt */}
          <Form.Item label={fr.start.customPromptLabel} name="prompt">
            <Input.TextArea
              rows={8}
              className="font-mono text-xs"
              placeholder={fr.start.customPromptPlaceholder}
            />
          </Form.Item>

          {selectedBrand && (
            <Paragraph type="secondary" className="text-xs mb-6 -mt-2">
              {fr.start.promptSyncedFrom} <strong>{selectedBrand.brandName}</strong>
            </Paragraph>
          )}

          <Form.Item className="mb-0">
            {loading ? (
              <Button
                type="primary"
                size="large"
                icon={<LoadingOutlined spin />}
                disabled
                block
                className="h-12 text-base font-semibold"
              >
                {loadingMessage}
              </Button>
            ) : (
              <Button
                htmlType="submit"
                type="primary"
                size="large"
                icon={<ThunderboltOutlined />}
                block
                className="h-12 text-base font-semibold"
              >
                {fr.start.generateButton}
              </Button>
            )}
          </Form.Item>
        </Form>
      </Card>

      {/* Preloaded Demo Stories / Quick Launch */}
      {recentProjects.length > 0 && (
        <div className="w-full max-w-[80ch] mt-10">
          <Typography.Title level={5} className="text-gray-500 uppercase tracking-wider text-xs mb-3">
            {fr.start.quickLaunchTitle}
          </Typography.Title>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recentProjects.map((proj) => (
              <div
                key={proj.id}
                onClick={() => onNavigateToEditor(proj.id)}
                className="p-3.5 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 hover:shadow-md cursor-pointer transition-all flex items-center justify-between group"
              >
                <div className="truncate mr-3">
                  <span className="font-semibold text-sm text-gray-800 dark:text-gray-200 block truncate group-hover:text-blue-600">
                    {proj.name}
                  </span>
                  <span className="text-xs text-gray-400 font-mono">{proj.id}</span>
                </div>
                <Button
                  size="small"
                  type="text"
                  icon={<PlayCircleOutlined />}
                  className="text-blue-600"
                >
                  {fr.navigation.openProject}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </Flex>
  );
};

export default StartPage;
