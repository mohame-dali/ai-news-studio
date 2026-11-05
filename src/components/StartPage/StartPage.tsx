import React, { FC, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Flex,
  Form,
  Input,
  Select,
  Tag,
  Typography,
} from "antd";
import { LoadingOutlined, PlayCircleOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { defaultBrands, defaultFetchers, buildDefaultConfig } from "@/lib/constants";
import { generateManuscriptFromInput } from "@/lib/articleGenerator";
import {
  assertOllamaRunning,
  rankNewsWithOllama,
  resetOllamaFallbackStatus,
  wasOllamaFallbackUsed,
} from "@/services/ollamaClient";
import { DurationOption, NewsGroupItem, RankedNewsItem } from "@/types";
import { useGlobalState } from "@/state/globalState";
import { getProjectList, saveGeneration, GenerationRecord } from "@/lib/storage";
import { fr } from "@/lib/i18n";

const { Title, Paragraph } = Typography;

type FormType = {
  fetcherId: string;
  brandId: string;
  prompt: string;
  inputs: Record<string, string>;
  durationOption: DurationOption;
};

type SourceStatus = { id: string; name: string; ok: boolean; count: number; error?: string };

interface Props {
  onNavigateToEditor: (generationId: string) => void;
}

export const StartPage: FC<Props> = ({ onNavigateToEditor }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormType>();
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(fr.start.generating);
  const [fallbackGenerationId, setFallbackGenerationId] = useState<string | null>(null);
  const [recentProjects, setRecentProjects] = useState<{ id: string; name: string }[]>([]);
  const [newsItems, setNewsItems] = useState<RankedNewsItem[]>([]);
  const [sourceStatuses, setSourceStatuses] = useState<SourceStatus[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [newsCachedAt, setNewsCachedAt] = useState<string | null>(null);
  const [rankingNotice, setRankingNotice] = useState<string | null>(null);

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
        durationOption: "standard",
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

  const loadNewsroom = async (refresh = false) => {
    setNewsLoading(true);
    setNewsError(null);
    try {
      const response = await fetch(`/api/news/trending${refresh ? "?refresh=true" : ""}`);
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Impossible de charger les sources d'actualité.");
      const ranking = await rankNewsWithOllama((data.items || []) as NewsGroupItem[], refresh);
      setNewsItems(ranking.items);
      setSourceStatuses(data.sources || []);
      setNewsCachedAt(data.cachedAt || ranking.cachedAt);
      setRankingNotice(ranking.notice || null);
    } catch (error) {
      setNewsError(error instanceof Error ? error.message : "Impossible de charger les sources d'actualité.");
    } finally {
      setNewsLoading(false);
    }
  };

  useEffect(() => {
    void loadNewsroom();
  }, []);

  const loadManuscript = async (values: FormType) => {
    const { fetcherId, brandId, prompt } = values;
    const brand = defaultBrands.find((b) => b.id === brandId) || defaultBrands[0];

    setLoading(true);
    setFallbackGenerationId(null);
    resetOllamaFallbackStatus();
    setLoadingMessage(fr.start.fetchingArticle);

    try {
      await assertOllamaRunning();
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
        baseConfig,
        { durationOption: values.durationOption || "standard", onProgress: setLoadingMessage }
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
          durationOption: values.durationOption || "standard",
          isSensitive: cleanedManuscript.meta.isSensitive,
          sources: cleanedManuscript.meta.sources,
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

      if (wasOllamaFallbackUsed()) {
        setFallbackGenerationId(result.projectId);
      } else {
        message.success("Sujet vidéo généré avec succès !");
        onNavigateToEditor(result.projectId);
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Erreur de génération du sujet vidéo", 7);
    } finally {
      setLoading(false);
      setLoadingMessage(fr.start.generating);
    }
  };

  const startFromNewsCard = (item: RankedNewsItem) => {
    if (!item.link) {
      message.error("Cette suggestion ne contient pas d'URL d'article exploitable.");
      return;
    }
    form.setFieldsValue({ fetcherId: "web", inputs: { url: item.link } });
    void loadManuscript({
      fetcherId: "web",
      brandId: form.getFieldValue("brandId") || defaultBrands[0].id,
      prompt: form.getFieldValue("prompt") || defaultBrands[0].scriptPrompt,
      inputs: { url: item.link },
      durationOption: form.getFieldValue("durationOption") || "standard",
    });
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

      <section className="w-full max-w-[80ch] mb-8" aria-label="Actualités à traiter">
        <Flex justify="space-between" align="center" className="mb-3" wrap="wrap" gap="small">
          <div>
            <Title level={3} className="!mb-0">Actualités à traiter</Title>
            <Typography.Text type="secondary">Suggestions IA — à valider par le rédacteur</Typography.Text>
          </div>
          <Flex gap="small" align="center">
            {newsCachedAt && <Typography.Text type="secondary" className="text-xs">résultat en cache depuis {Math.max(0, Math.floor((Date.now() - new Date(newsCachedAt).getTime()) / 60000))} min</Typography.Text>}
            <Button onClick={() => void loadNewsroom(true)} loading={newsLoading}>Actualiser</Button>
          </Flex>
        </Flex>
        {rankingNotice && <Alert className="mb-3" type="info" showIcon message={rankingNotice} />}
        {newsError && <Alert className="mb-3" type="warning" showIcon message="Salle de rédaction indisponible" description={newsError} />}
        {newsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 5 }).map((_, index) => <Card key={index} loading size="small" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {newsItems.map((item) => (
              <Card key={item.id} hoverable size="small" onClick={() => startFromNewsCard(item)} className="h-full">
                <Flex vertical gap="small">
                  <Flex justify="space-between" gap="small">
                    <Tag color={item.category === "france" ? "blue" : item.category === "europe" ? "purple" : "gold"}>{item.category}</Tag>
                    <Typography.Text type="secondary" className="text-xs">{new Date(item.pubDate).toLocaleDateString("fr-FR")}</Typography.Text>
                  </Flex>
                  <Typography.Text strong>{item.title}</Typography.Text>
                  <Typography.Text type="secondary" className="text-xs">{item.source} · {item.sourceCount} source{item.sourceCount > 1 ? "s" : ""}</Typography.Text>
                  <Typography.Text className="text-xs italic">{item.reason}</Typography.Text>
                </Flex>
              </Card>
            ))}
          </div>
        )}
        {sourceStatuses.length > 0 && (
          <Flex wrap="wrap" gap="small" className="mt-3">
            {sourceStatuses.map((source) => <Tag key={source.id} color={source.ok ? "success" : "error"}>{source.name}: {source.ok ? `${source.count} articles` : source.error || "indisponible"}</Tag>)}
          </Flex>
        )}
      </section>

      <Card
        className="w-full max-w-[80ch] shadow-xl border-gray-200 dark:border-gray-800"
        styles={{ body: { padding: "2rem" } }}
      >
        {fallbackGenerationId && (
          <Alert
            className="mb-4"
            type="warning"
            showIcon
            message="Génération terminée en mode secours (Ollama trop lent). Veuillez vérifier le script manuellement."
            action={
              <Button
                size="small"
                onClick={() => {
                  const generationId = fallbackGenerationId;
                  setFallbackGenerationId(null);
                  onNavigateToEditor(generationId);
                }}
              >
                Ouvrir l’éditeur
              </Button>
            }
          />
        )}
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

          <Form.Item name="durationOption" label="Durée du script" rules={[{ required: true }]}>
            <Select
              size="large"
              options={[
                { value: "court", label: "Court (15–30 s)" },
                { value: "standard", label: "Standard (60 s)" },
                { value: "long", label: "Long (120 s)" },
              ]}
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
