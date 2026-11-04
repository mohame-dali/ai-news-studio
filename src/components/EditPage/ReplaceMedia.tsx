import React, { useState } from "react";
import { MediaAssetType } from "@/types";
import { Alert, Button, Empty, Flex, Input, Spin, Tag, Typography, message } from "antd";
import { SearchOutlined, CheckCircleOutlined, WarningOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { searchWikimediaMedia, MediaResult } from "@/services/mediaService";

interface Props {
  alternativeMedia?: MediaAssetType[];
  currentMedia?: MediaAssetType;
  onSelectMedia: (asset: MediaAssetType) => void;
  onValidateLicense?: (validated: boolean) => void;
}

export const ReplaceMedia: React.FC<Props> = ({
  alternativeMedia = [],
  currentMedia,
  onSelectMedia,
  onValidateLicense,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<MediaResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      message.warning("Entrez un terme de recherche (ex: Paris, Macron, économie...)");
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    try {
      const results = await searchWikimediaMedia(searchQuery.trim(), 12);
      setSearchResults(results);
    } catch {
      message.error("Échec de la recherche sur Wikimedia Commons.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectWikimedia = (item: MediaResult) => {
    let asset: MediaAssetType;
    if (item.type === "video") {
      asset = {
        type: "video",
        url: item.url,
        byline: item.author,
        author: item.author,
        description: item.title || item.description,
        license: item.license,
        licenseUrl: item.licenseUrl,
        licenseValidated: true, // User intentionally selected validated legal media
        source: "Wikimedia Commons",
        videoAsset: {
          id: `vid-wiki-${Date.now()}`,
          title: item.title || "Vidéo Wikimedia",
          duration: item.duration || 10,
          streamUrls: { mp4: item.url },
        },
      };
    } else {
      asset = {
        type: "image",
        url: item.url,
        byline: item.author,
        author: item.author,
        description: item.title || item.description,
        license: item.license,
        licenseUrl: item.licenseUrl,
        licenseValidated: true, // User intentionally selected validated legal media
        source: "Wikimedia Commons",
        imageAsset: {
          id: `img-wiki-${Date.now()}`,
          size: { width: item.width || 1200, height: item.height || 800 },
        },
      };
    }

    onSelectMedia(asset);
    onValidateLicense?.(true);
    message.success(`Média sélectionné avec licence conforme : ${item.license || "CC"}`);
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
      {/* STEP 5: Face & Plate Blurring Warning */}
      <Alert
        type="warning"
        showIcon
        icon={<WarningOutlined />}
        message="Droit à l'image & Conformité RGPD"
        description="Si le média contient des visages identifiables ou des plaques d'immatriculation sans consentement exprès, veillez à flouter les zones sensibles avant l'exportation."
        className="mb-4 text-xs"
      />

      {/* RIGHTS CARD (Current Media) */}
      {currentMedia && (
        <div className="mb-4 p-3 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg">
          <Flex justify="space-between" align="center" className="mb-1">
            <Typography.Text strong className="text-xs uppercase tracking-wider text-blue-900 dark:text-blue-300 flex items-center gap-1">
              <SafetyCertificateOutlined /> Carte de Droits d'Auteur
            </Typography.Text>
            {currentMedia.licenseValidated ? (
              <Tag color="success" className="text-[11px] font-semibold">
                <CheckCircleOutlined /> Licence Validée
              </Tag>
            ) : (
              <Tag color="warning" className="text-[11px] font-semibold">
                ⚠️ Validation Requise
              </Tag>
            )}
          </Flex>

          <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-700 dark:text-gray-300 mt-2">
            <div>
              <span className="text-gray-500 block">Source :</span>
              <span className="font-semibold">{currentMedia.source || "Article source"}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Auteur / Crédit :</span>
              <span className="font-semibold truncate block" title={currentMedia.byline}>
                {currentMedia.byline || "Non spécifié"}
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-500 block">Licence d'exploitation :</span>
              {currentMedia.licenseUrl ? (
                <a
                  href={currentMedia.licenseUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline font-semibold"
                >
                  {currentMedia.license || "Creative Commons (Détails)"}
                </a>
              ) : (
                <span className="font-semibold">{currentMedia.license || "Droit de citation de presse"}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Search Wikimedia Commons */}
      <div className="mb-4">
        <Typography.Text strong className="block mb-1.5 text-xs text-gray-700 dark:text-gray-300">
          Rechercher des médias légaux libres de droits (Wikimedia Commons) :
        </Typography.Text>
        <Flex gap="small">
          <Input
            placeholder="Ex : Tour Eiffel, Parlement européen, manifestation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onPressEnter={handleSearch}
            prefix={<SearchOutlined className="text-gray-400" />}
            size="middle"
          />
          <Button type="primary" onClick={handleSearch} loading={isSearching}>
            Rechercher
          </Button>
        </Flex>
      </div>

      {/* Search Results */}
      {isSearching && (
        <div className="py-6 text-center">
          <Spin tip="Interrogation de Wikimedia Commons..." />
        </div>
      )}

      {!isSearching && hasSearched && searchResults.length === 0 && (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Aucun média libre trouvé sur Wikimedia pour cette recherche."
          className="my-3"
        />
      )}

      {!isSearching && searchResults.length > 0 && (
        <div className="mb-4">
          <Typography.Text strong className="block mb-2 text-xs text-gray-500 uppercase tracking-wider">
            Résultats Wikimedia Commons ({searchResults.length}) :
          </Typography.Text>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-56 overflow-y-auto p-1 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            {searchResults.map((item) => (
              <div
                key={item.id}
                onClick={() => handleSelectWikimedia(item)}
                className="group relative cursor-pointer rounded overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-blue-500 bg-white dark:bg-gray-900 transition-all shadow-2xs hover:shadow-sm"
              >
                <img
                  src={item.thumbnail}
                  alt={item.title}
                  className="w-full h-20 object-cover group-hover:scale-105 transition-transform duration-150"
                  loading="lazy"
                />
                <div className="p-1">
                  <div className="text-[10px] font-semibold truncate text-gray-800 dark:text-gray-200" title={item.title}>
                    {item.title}
                  </div>
                  <Tag color="blue" className="text-[9px] px-1 py-0 leading-tight m-0 mt-0.5 max-w-full truncate">
                    {item.license || "CC"}
                  </Tag>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Media from original article */}
      {alternativeMedia.length > 0 && (
        <div>
          <Typography.Text strong className="block mb-2 text-xs text-gray-500 uppercase tracking-wider">
            Médias de l'article source :
          </Typography.Text>
          <Flex gap="small" wrap="wrap">
            {alternativeMedia.map((asset, idx) => {
              if (asset.type === "image") {
                return (
                  <img
                    key={idx}
                    src={asset.url}
                    alt={asset.description || "Photo de l'article"}
                    className="w-16 h-16 object-cover rounded cursor-pointer border-2 border-transparent hover:border-blue-500 transition-all shadow-xs"
                    onClick={() => {
                      onSelectMedia(asset);
                      onValidateLicense?.(Boolean(asset.licenseValidated));
                    }}
                  />
                );
              }
              if (asset.type === "video") {
                return (
                  <div
                    key={idx}
                    className="w-16 h-16 bg-gray-900 rounded cursor-pointer border-2 border-transparent hover:border-blue-500 flex flex-col items-center justify-center text-white text-[10px] p-1 text-center"
                    onClick={() => {
                      onSelectMedia(asset);
                      onValidateLicense?.(Boolean(asset.licenseValidated));
                    }}
                  >
                    <span>▶ Vidéo</span>
                  </div>
                );
              }
              return (
                <div
                  key={idx}
                  className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded cursor-pointer border-2 border-transparent hover:border-blue-500 flex items-center justify-center text-blue-700 dark:text-blue-200 text-[10px] font-semibold"
                  onClick={() => {
                    onSelectMedia(asset);
                    onValidateLicense?.(true);
                  }}
                >
                  📍 Carte
                </div>
              );
            })}
          </Flex>
        </div>
      )}
    </div>
  );
};

export default ReplaceMedia;
