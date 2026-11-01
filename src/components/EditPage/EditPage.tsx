import React, { FC, useEffect, useState } from "react";
import { Alert, Button, Flex, Form, Spin, Tooltip, Typography, message } from "antd";
import { SettingOutlined, ShareAltOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import { Tab, useGlobalState } from "@/state/globalState";
import { EditorialStatus } from "@/types";
import PreviewOutput from "./Preview/PreviewOutput";
import SortableTabs from "../SortableTabs";
import SegmentList from "./SegmentList";
import EditConfig from "./EditConfig";
import AddFetchedArticle from "./AddFetchedArticle";
import EditorialWorkspace from "./EditorialWorkspace";
import { getGeneration, saveGeneration, updateEditorialStatus } from "@/lib/storage";
import { fr } from "@/lib/i18n";

interface Props {
  generationParamId?: string;
  onNavigateHome?: () => void;
}

export const EditPage: FC<Props> = ({ generationParamId, onNavigateHome }) => {
  const {
    config,
    tabs,
    setConfig,
    setTabs,
    setSelectedProject,
    setGenerationId,
    generationId,
  } = useGlobalState();

  const [editTheme, setEditTheme] = useState(false);
  const [selectedTabKey, setSelectedTabKey] = useState<string | undefined>(
    tabs[0]?.manuscript?.meta?.uniqueId
  );
  const [openArticleModal, setOpenArticleModal] = useState(false);
  const [loadingGeneration, setLoadingGeneration] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSplitView, setIsSplitView] = useState(false);

  const [form] = Form.useForm();

  useEffect(() => {
    const targetId = generationParamId || generationId || "arctic-climate-summit";
    setLoadingGeneration(true);
    setLoadError(null);

    try {
      const record = getGeneration(targetId);
      if (!record) {
        setLoadError("Projet ou sujet vidéo introuvable.");
        setLoadingGeneration(false);
        return;
      }

      setConfig({
        projectId: record.projectId,
        config: record.config,
      });
      setTabs(record.data);
      setSelectedProject(record.project);
      setGenerationId(record.id);
      setSelectedTabKey(record.data?.[0]?.manuscript?.meta?.uniqueId);

      form.setFieldsValue({
        tabs: record.data,
        config: record.config,
      });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Erreur de chargement du sujet vidéo");
    } finally {
      setLoadingGeneration(false);
    }
  }, [generationParamId, generationId, setConfig, setTabs, setSelectedProject, setGenerationId, form]);

  useEffect(() => {
    if (!selectedTabKey && tabs.length > 0) {
      setSelectedTabKey(tabs[0]?.manuscript?.meta?.uniqueId);
    }
  }, [tabs, selectedTabKey]);

  // Keep form tabs synchronized when store changes
  useEffect(() => {
    form.setFieldsValue({ tabs });
  }, [tabs, form]);

  // Auto-save when tabs change (debounced could be added)
  useEffect(() => {
    if (generationId && tabs.length > 0) {
      const existing = getGeneration(generationId);
      if (existing) {
        existing.data = tabs;
        saveGeneration(existing);
      }
    }
  }, [tabs, generationId]);

  const handleAddArticle = (newTab: Tab) => {
    const currentTabs = (form.getFieldValue("tabs") || tabs || []) as Tab[];
    const nextTabs = [...currentTabs, newTab];
    form.setFieldValue("tabs", nextTabs);
    setTabs(nextTabs);
    setSelectedTabKey(newTab.manuscript.meta.uniqueId);
  };

  const handleUpdateEditorialStatus = (newStatus: EditorialStatus, note?: string) => {
    if (generationId) {
      updateEditorialStatus(generationId, newStatus, note);
      const existing = getGeneration(generationId);
      if (existing && existing.data) {
        setTabs(existing.data);
        form.setFieldValue("tabs", existing.data);
      }
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    message.success(fr.navigation.shareSuccess);
  };

  if (loadingGeneration || !config) {
    return (
      <Flex vertical align="center" justify="center" className="p-16 min-h-[60vh] gap-4">
        {loadError ? (
          <Alert
            type="error"
            message="Erreur de chargement du sujet"
            description={loadError}
            action={
              <Button type="primary" onClick={onNavigateHome}>
                {fr.navigation.home}
              </Button>
            }
          />
        ) : (
          <Flex vertical align="center" gap="middle">
            <Spin size="large" />
            <Typography.Text className="text-gray-500">Chargement du sujet vidéo d'actualité...</Typography.Text>
          </Flex>
        )}
      </Flex>
    );
  }

  return (
    <Form
      preserve
      initialValues={{ tabs, config: config.config }}
      layout="vertical"
      form={form}
      onValuesChange={(_changed, allValues) => {
        if (allValues.tabs) {
          setTabs(allValues.tabs);
        }
      }}
    >
      <div className="max-w-[1440px] mx-auto px-4 py-3">
        {/* Top Navbar */}
        <Flex justify="space-between" align="center" className="py-2.5 mb-4 border-b border-gray-200 dark:border-gray-800">
          <Flex align="center" gap="middle">
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={onNavigateHome}
              className="text-gray-500 hover:text-black"
            >
              {fr.navigation.home}
            </Button>
            <Typography.Title
              level={4}
              style={{ margin: 0, cursor: "pointer" }}
              onClick={onNavigateHome}
              className="font-bold tracking-tight text-blue-600"
            >
              {fr.app.title}
            </Typography.Title>
          </Flex>

          <Flex gap="small" align="center">
            <Tooltip title={fr.navigation.share}>
              <Button icon={<ShareAltOutlined />} onClick={handleShare}>
                {fr.navigation.share}
              </Button>
            </Tooltip>
            <Tooltip title={editTheme ? fr.navigation.backToSegments : fr.navigation.themeConfig}>
              <Button
                type={editTheme ? "primary" : "default"}
                icon={<SettingOutlined />}
                onClick={() => setEditTheme(!editTheme)}
              >
                {editTheme ? fr.navigation.editingTheme : fr.navigation.themeConfig}
              </Button>
            </Tooltip>
          </Flex>
        </Flex>

        {/* Main Workspace Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Player & Preview Output */}
          <div className="lg:col-span-5 w-full">
            <Form.Item noStyle shouldUpdate>
              {({ getFieldsValue }) => {
                const currentTabs = getFieldsValue(true).tabs || tabs;
                return <PreviewOutput tabs={currentTabs} />;
              }}
            </Form.Item>
          </div>

          {/* Right Column: Article Tabs & Segment Editors OR Theme Config */}
          <div className="lg:col-span-7 w-full">
            {!editTheme ? (
              <Form.List name={["tabs"]}>
                {(tabItems, { move }) => (
                  <SortableTabs
                    allowAdd
                    onAdd={() => setOpenArticleModal(true)}
                    activeKey={selectedTabKey}
                    onChange={(val) => setSelectedTabKey(val)}
                    onReorder={(from, to) => move(from, to)}
                    items={tabItems.map((t) => {
                      const tab = form.getFieldValue(["tabs", t.name]) || tabs[t.name];
                      const uniqueId = tab?.manuscript?.meta?.uniqueId || `tab-${t.name}`;
                      const title = tab?.manuscript?.meta?.title || "Article sans titre";

                      return {
                        key: uniqueId,
                        label: (
                          <span
                            className="max-w-[180px] sm:max-w-[220px] truncate block select-none text-xs font-semibold"
                            title={title}
                          >
                            {title}
                          </span>
                        ),
                        children: tab ? (
                          <div className="space-y-4">
                            <EditorialWorkspace
                              tab={tab}
                              onUpdateStatus={handleUpdateEditorialStatus}
                              isSplitView={isSplitView}
                              onToggleSplitView={() => setIsSplitView(!isSplitView)}
                            />
                            <SegmentList
                              index={t.name}
                              manuscript={tab.manuscript}
                            />
                          </div>
                        ) : null,
                        forceRender: true,
                      };
                    })}
                  />
                )}
              </Form.List>
            ) : (
              <EditConfig />
            )}
          </div>
        </div>
      </div>

      <AddFetchedArticle
        open={openArticleModal}
        setOpen={setOpenArticleModal}
        onChange={handleAddArticle}
      />
    </Form>
  );
};

export default EditPage;
