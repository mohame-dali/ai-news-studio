import React, { FC, useState } from "react";
import { FetcherOption, Tab } from "@/types";
import { defaultFetchers } from "@/lib/constants";
import { generateManuscriptFromInput } from "@/lib/articleGenerator";
import { useGlobalState } from "@/state/globalState";
import { Button, Form, Input, Modal, Select, Typography, message } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import { fr } from "@/lib/i18n";

interface Props {
  open: boolean;
  setOpen: (open: boolean) => void;
  brandId?: string;
  onChange: (tab: Tab) => void;
}

export const AddFetchedArticle: FC<Props> = ({ open, setOpen, onChange }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { config } = useGlobalState();
  const selectedFetcherId = Form.useWatch("fetcherId", form) || defaultFetchers[0].id;
  const selectedFetcher = defaultFetchers.find((f) => f.id === selectedFetcherId);

  const handleFinish = async (values: { fetcherId: string; inputs: Record<string, string> }) => {
    setLoading(true);
    try {
      const res = await generateManuscriptFromInput(
        values.fetcherId,
        values.inputs || {},
        config.config
      );

      const newTab: Tab = {
        articleUrl: res.projectId,
        projectId: res.projectId,
        manuscript: res.manuscript,
        editorialStatus: "script_generated",
        originalArticle: res.sourceArticle,
        originalScriptSnapshot: res.manuscript.segments.map((s) => s.text || ""),
        revisions: [
          {
            timestamp: new Date().toISOString(),
            status: "script_generated",
            note: "Article ajouté à la série de sujets",
            snapshotTexts: res.manuscript.segments.map((s) => s.text || ""),
          },
        ],
      };

      onChange(newTab);
      message.success("Article importé avec succès dans le sujet !");
      setOpen(false);
      form.resetFields();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Erreur lors de l'importation de l'article", 7);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      title={fr.editor.addArticleTitle}
      onCancel={() => setOpen(false)}
      footer={null}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ fetcherId: defaultFetchers[0].id, inputs: {} }}
        onFinish={handleFinish}
      >
        <Form.Item name="fetcherId" label={fr.start.fetcherLabel} rules={[{ required: true }]}>
          <Select
            options={defaultFetchers.map((f) => ({
              value: f.id,
              label: f.title,
            }))}
          />
        </Form.Item>

        {selectedFetcher?.description && (
          <Typography.Paragraph type="secondary" className="text-xs mb-3">
            {selectedFetcher.description}
          </Typography.Paragraph>
        )}

        {(selectedFetcher?.fields || [])
          .filter((f) => f.name !== "project_id")
          .map((field) => (
            <Form.Item
              key={field.name}
              name={["inputs", field.name]}
              label={field.label}
              rules={field.required ? [{ required: true, message: `Le champ ${field.label} est requis` }] : undefined}
            >
              {field.name === "body" ? (
                <Input.TextArea rows={4} placeholder={field.placeholder} />
              ) : (
                <Input placeholder={field.placeholder} />
              )}
            </Form.Item>
          ))}

        <div className="flex justify-end gap-2 mt-4">
          <Button onClick={() => setOpen(false)}>{fr.editor.cancel}</Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            {loading ? fr.editor.importing : fr.editor.importAndAdd}
          </Button>
        </div>
      </Form>
    </Modal>
  );
};

export default AddFetchedArticle;
