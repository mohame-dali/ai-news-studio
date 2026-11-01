import React, { FC, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Dropdown,
  Flex,
  Input,
  MenuProps,
  Modal,
  Row,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import {
  AuditOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  HistoryOutlined,
  LinkOutlined,
  SafetyCertificateOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { ArticleSourceData, EditorialStatus, SegmentType, Tab } from "@/types";
import { fr } from "@/lib/i18n";
import { verifyScriptAgainstSource } from "@/lib/editorialVerifier";

const { Title, Text, Paragraph } = Typography;

interface Props {
  tab: Tab;
  onUpdateStatus: (newStatus: EditorialStatus, note?: string) => void;
  isSplitView: boolean;
  onToggleSplitView: () => void;
}

const statusConfig: Record<
  EditorialStatus,
  { label: string; color: string; badgeStatus: "default" | "processing" | "warning" | "error" | "success" }
> = {
  imported: { label: fr.editorial.status.imported, color: "default", badgeStatus: "default" },
  script_generated: { label: fr.editorial.status.script_generated, color: "blue", badgeStatus: "processing" },
  under_review: { label: fr.editorial.status.under_review, color: "orange", badgeStatus: "warning" },
  corrections_required: { label: fr.editorial.status.corrections_required, color: "red", badgeStatus: "error" },
  approved: { label: fr.editorial.status.approved, color: "green", badgeStatus: "success" },
};

export const EditorialWorkspace: FC<Props> = ({
  tab,
  onUpdateStatus,
  isSplitView,
  onToggleSplitView,
}) => {
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [approvalNote, setApprovalNote] = useState("");
  const [sourceSearchTerm, setSourceSearchTerm] = useState("");

  const currentStatus: EditorialStatus = tab.editorialStatus || "under_review";
  const source: ArticleSourceData | undefined = tab.originalArticle;
  const segments: SegmentType[] = tab.manuscript?.segments || [];

  const verificationReport = useMemo(() => {
    return verifyScriptAgainstSource(segments, source);
  }, [segments, source]);

  const statusMenuItems: MenuProps["items"] = [
    {
      key: "under_review",
      label: (
        <Space>
          <Tag color="orange">{fr.editorial.status.under_review}</Tag>
          <Text type="secondary" className="text-xs">
            {fr.editorial.statusHelp.under_review}
          </Text>
        </Space>
      ),
    },
    {
      key: "corrections_required",
      label: (
        <Space>
          <Tag color="red">{fr.editorial.status.corrections_required}</Tag>
          <Text type="secondary" className="text-xs">
            {fr.editorial.statusHelp.corrections_required}
          </Text>
        </Space>
      ),
    },
    {
      key: "script_generated",
      label: (
        <Space>
          <Tag color="blue">{fr.editorial.status.script_generated}</Tag>
          <Text type="secondary" className="text-xs">
            {fr.editorial.statusHelp.script_generated}
          </Text>
        </Space>
      ),
    },
  ];

  const handleStatusMenuClick: MenuProps["onClick"] = (e) => {
    const nextStatus = e.key as EditorialStatus;
    onUpdateStatus(nextStatus);
    message.info(`Statut éditorial mis à jour : ${statusConfig[nextStatus].label}`);
  };

  const handleConfirmApproval = () => {
    onUpdateStatus("approved", approvalNote || "Validation éditoriale certifiée par le journaliste");
    setShowApprovalModal(false);
    setApprovalNote("");
    message.success("Sujet certifié et validé pour production vidéo !");
  };

  const handleRevokeApproval = () => {
    onUpdateStatus("under_review", "Réouverture de la révision par le journaliste");
    message.warning("Validation éditoriale révoquée : retour en révision.");
  };

  return (
    <div className="mb-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 shadow-xs">
      {/* Top Editorial Toolbar */}
      <Flex justify="space-between" align="center" wrap="wrap" gap="small">
        <Flex align="center" gap="small" wrap="wrap">
          <Text strong className="text-xs uppercase tracking-wider text-gray-500">
            {fr.editorial.statusLabel} :
          </Text>

          <Dropdown
            menu={{ items: statusMenuItems, onClick: handleStatusMenuClick }}
            trigger={["click"]}
            disabled={currentStatus === "approved"}
          >
            <Tag
              color={statusConfig[currentStatus].color}
              className="cursor-pointer text-xs font-semibold px-2.5 py-1 rounded-md flex items-center gap-1.5"
            >
              <Badge status={statusConfig[currentStatus].badgeStatus} />
              {statusConfig[currentStatus].label}
            </Tag>
          </Dropdown>

          {currentStatus === "approved" && (
            <Tooltip title="Rouvrir la révision pour autoriser des modifications supplémentaires">
              <Button size="small" type="link" danger onClick={handleRevokeApproval}>
                {fr.editorial.revokeApproval}
              </Button>
            </Tooltip>
          )}
        </Flex>

        <Flex align="center" gap="small" wrap="wrap">
          {/* Toggle Split View / Source Panel */}
          <Button
            size="small"
            type={isSplitView ? "primary" : "default"}
            icon={<EyeOutlined />}
            onClick={onToggleSplitView}
          >
            {isSplitView ? fr.editorial.hideSource : fr.editorial.showSource}
          </Button>

          {/* Factual & Ethical Verification Warning Tool */}
          <Button
            size="small"
            danger={verificationReport.totalAlerts > 0}
            icon={verificationReport.totalAlerts > 0 ? <WarningOutlined /> : <CheckCircleOutlined />}
            onClick={() => setShowVerificationModal(true)}
            className={verificationReport.totalAlerts > 0 ? "border-amber-500 text-amber-600 dark:text-amber-400" : ""}
          >
            {fr.editorial.verificationButton}
            {verificationReport.totalAlerts > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-bold text-[11px] rounded-full">
                {verificationReport.totalAlerts}
              </span>
            )}
          </Button>

          {/* Revision History */}
          <Tooltip title="Consulter l'historique des modifications">
            <Button
              size="small"
              icon={<HistoryOutlined />}
              onClick={() => setShowHistoryModal(true)}
            >
              {fr.editorial.revisionsTitle}
            </Button>
          </Tooltip>

          {/* Mandatory Human Approval Action */}
          {currentStatus !== "approved" ? (
            <Button
              size="small"
              type="primary"
              className="bg-emerald-600 hover:bg-emerald-500 font-semibold"
              icon={<SafetyCertificateOutlined />}
              onClick={() => setShowApprovalModal(true)}
            >
              {fr.editorial.approveButton}
            </Button>
          ) : (
            <Tag color="success" className="px-2.5 py-1 font-semibold text-xs flex items-center gap-1">
              <CheckCircleOutlined /> {fr.editorial.status.approved}
            </Tag>
          )}
        </Flex>
      </Flex>

      {/* Side-by-Side Source View Pane (Expanded on Demand) */}
      {isSplitView && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <Card
            size="small"
            className="bg-gray-50/70 dark:bg-gray-900/60 border-blue-200 dark:border-blue-900"
            title={
              <Flex justify="space-between" align="center">
                <Space>
                  <AuditOutlined className="text-blue-600" />
                  <Text strong className="text-sm">
                    {fr.editorial.sourcePanelTitle}
                  </Text>
                </Space>
                <Tag color="cyan" className="font-normal text-xs">
                  {source?.publisher || "Source d'actualité externe"}
                </Tag>
              </Flex>
            }
          >
            {source ? (
              <div className="space-y-3">
                {/* Metadata Summary */}
                <Descriptions
                  size="small"
                  column={{ xs: 1, sm: 2, md: 3 }}
                  bordered
                  className="bg-white dark:bg-gray-800 rounded-md"
                >
                  <Descriptions.Item label={fr.editorial.publisher}>
                    <Text strong>{source.publisher || "Non spécifié"}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label={fr.editorial.author}>
                    {source.author || "Non spécifié (Dépêche d'agence)"}
                  </Descriptions.Item>
                  <Descriptions.Item label={fr.editorial.pubdate}>
                    {source.pubdate ? new Date(source.pubdate).toLocaleDateString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "Date non précisée"}
                  </Descriptions.Item>
                  {source.url && (
                    <Descriptions.Item label={fr.editorial.originalUrl} span={3}>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1 text-xs truncate max-w-xl"
                      >
                        <LinkOutlined /> {source.url}
                      </a>
                    </Descriptions.Item>
                  )}
                </Descriptions>

                {/* Read-Only Notice */}
                <Alert
                  type="info"
                  showIcon
                  message={
                    <span className="text-xs text-gray-600 dark:text-gray-300">
                      {fr.editorial.readOnlyNotice}
                    </span>
                  }
                  className="py-1 px-3"
                />

                {/* Search within original article */}
                <Input
                  size="small"
                  placeholder="Rechercher un terme, un chiffre ou un nom dans la dépêche..."
                  value={sourceSearchTerm}
                  onChange={(e) => setSourceSearchTerm(e.target.value)}
                  allowClear
                  className="max-w-md"
                />

                {/* Source Article Body */}
                <div className="max-h-[280px] overflow-y-auto p-3 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 text-xs sm:text-sm leading-relaxed whitespace-pre-line font-serif text-gray-800 dark:text-gray-200">
                  {source.content}
                </div>
              </div>
            ) : (
              <Alert
                type="warning"
                message="Aucune métadonnée d'article source rattachée à cette séquence."
                description="Importez un nouvel article via l'outil d'importation pour bénéficier de la comparaison directe en double-écran."
              />
            )}
          </Card>
        </div>
      )}

      {/* Modal: Contrôle Déontologique & Factuel */}
      <Modal
        open={showVerificationModal}
        onCancel={() => setShowVerificationModal(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setShowVerificationModal(false)}>
            Fermer le contrôle
          </Button>,
        ]}
        width={700}
        title={
          <Space>
            <SafetyCertificateOutlined className="text-blue-600" />
            <span>{fr.editorial.verificationTitle}</span>
          </Space>
        }
      >
        <div className="space-y-4">
          <Alert
            type="warning"
            showIcon
            icon={<ExclamationCircleOutlined />}
            message="Avertissement déontologique strict"
            description={fr.editorial.disclaimer}
            className="text-xs"
          />

          <Flex justify="space-between" align="center" className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div>
              <Text strong className="text-sm block">
                Séquences sans écart détecté : {verificationReport.verifiedSegmentsCount} / {verificationReport.totalSegmentsCount}
              </Text>
              <Text type="secondary" className="text-xs">
                {verificationReport.totalAlerts === 0 ? fr.editorial.allVerified : `${verificationReport.totalAlerts} point(s) d'attention à vérifier avec la dépêche source.`}
              </Text>
            </div>
            <Tag color={verificationReport.totalAlerts === 0 ? "success" : "warning"} className="font-semibold text-xs px-2.5 py-1">
              {verificationReport.totalAlerts === 0 ? "Conforme" : "À vérifier"}
            </Tag>
          </Flex>

          <div className="space-y-2.5 max-h-[360px] overflow-y-auto">
            {verificationReport.alerts.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <CheckCircleOutlined className="text-3xl text-emerald-500 mb-2 block" />
                <Paragraph>{fr.editorial.allVerified}</Paragraph>
              </div>
            ) : (
              verificationReport.alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-3 bg-white dark:bg-gray-800 border-l-4 border-l-amber-500 border border-gray-200 dark:border-gray-700 rounded-r-lg shadow-2xs space-y-1 text-xs"
                >
                  <Flex justify="space-between" align="center">
                    <Space size="small">
                      <Tag color={alert.category === "chiffre" ? "volcano" : alert.category === "citation" ? "purple" : "gold"}>
                        {alert.category.toUpperCase()}
                      </Tag>
                      <Text strong>Séquence n°{alert.segmentIndex}</Text>
                    </Space>
                    <Tag color="default" className="font-mono">{alert.term}</Tag>
                  </Flex>
                  <Paragraph className="mb-0 text-gray-700 dark:text-gray-300">{alert.explanation}</Paragraph>
                  <Text type="secondary" className="block text-[11px] italic">
                    Conseil de vérification : {alert.suggestedAction}
                  </Text>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>

      {/* Modal: Certification & Human Approval */}
      <Modal
        open={showApprovalModal}
        onCancel={() => setShowApprovalModal(false)}
        onOk={handleConfirmApproval}
        okText={fr.editorial.confirmApprove}
        cancelText={fr.editor.cancel}
        okButtonProps={{ className: "bg-emerald-600 hover:bg-emerald-500" }}
        width={600}
        title={
          <Space>
            <SafetyCertificateOutlined className="text-emerald-600 text-lg" />
            <span>{fr.editorial.approvalModalTitle}</span>
          </Space>
        }
      >
        <div className="space-y-4 py-2">
          <Alert
            type="info"
            message="Engagement de responsabilité éditoriale"
            description={fr.editorial.approvalModalDesc}
            showIcon
          />

          {verificationReport.totalAlerts > 0 && (
            <Alert
              type="warning"
              showIcon
              message={`${verificationReport.totalAlerts} point(s) d'attention non corroborés`}
              description="Des chiffres ou termes du script n'ont pas été retrouvés textuellement dans la source. Assurez-vous d'avoir validé ces informations avant d'apposer votre visa."
            />
          )}

          <div>
            <Text strong className="text-xs block mb-1">
              Note ou justification éditoriale (facultatif) :
            </Text>
            <Input.TextArea
              rows={3}
              value={approvalNote}
              onChange={(e) => setApprovalNote(e.target.value)}
              placeholder={fr.editorial.revisionNotePlaceholder}
            />
          </div>
        </div>
      </Modal>

      {/* Modal: Revision History */}
      <Modal
        open={showHistoryModal}
        onCancel={() => setShowHistoryModal(false)}
        footer={[
          <Button key="close" onClick={() => setShowHistoryModal(false)}>
            Fermer
          </Button>,
        ]}
        width={650}
        title={
          <Space>
            <HistoryOutlined className="text-blue-600" />
            <span>{fr.editorial.revisionsTitle}</span>
          </Space>
        }
      >
        <div className="space-y-3 max-h-[380px] overflow-y-auto py-2">
          {tab.originalScriptSnapshot && (
            <Card size="small" title={fr.editorial.originalScriptSnapshot} className="bg-gray-50 dark:bg-gray-800">
              <ol className="list-decimal list-inside space-y-1 text-xs text-gray-700 dark:text-gray-300">
                {tab.originalScriptSnapshot.map((s, idx) => (
                  <li key={idx} className="font-medium">{s}</li>
                ))}
              </ol>
            </Card>
          )}

          <Divider className="my-2">{fr.editorial.revisionsTitle}</Divider>

          {(tab.revisions || []).length === 0 ? (
            <Text type="secondary" className="text-xs block text-center py-4">
              Aucune révision enregistrée sur ce projet.
            </Text>
          ) : (
            (tab.revisions || []).map((rev, idx) => (
              <div key={idx} className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs space-y-1">
                <Flex justify="space-between" align="center">
                  <Tag color={statusConfig[rev.status]?.color || "default"}>
                    {statusConfig[rev.status]?.label || rev.status}
                  </Tag>
                  <Text type="secondary" className="text-[11px]">
                    {new Date(rev.timestamp).toLocaleString("fr-FR")}
                  </Text>
                </Flex>
                {rev.note && <Paragraph className="mb-1 text-gray-800 dark:text-gray-200">{rev.note}</Paragraph>}
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
};

export default EditorialWorkspace;
