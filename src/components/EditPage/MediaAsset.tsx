import React, { FC, useState } from "react";
import { Button, Dropdown, MenuProps, Space, Tooltip } from "antd";
import { MediaAssetType } from "@/types";
import {
  CaretRightOutlined,
  DownOutlined,
  EditOutlined,
  GlobalOutlined,
  PictureOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import EditImage from "./EditImage";
import EditVideo from "./EditVideo";
import EditMap from "./EditMap";
import MapComponent from "../Map/MapComponent";
import { fr } from "@/lib/i18n";

interface Props {
  value?: MediaAssetType;
  onChange?: (value?: MediaAssetType) => void;
  allMedia?: MediaAssetType[];
  editable?: boolean;
}

export const MediaAsset: FC<Props> = ({
  value,
  onChange = () => {},
  allMedia = [],
  editable = true,
}) => {
  const [isEditAssetOpen, setIsEditAssetOpen] = useState(false);
  const [addType, setAddType] = useState<string | null>(null);

  const mediaMenu: MenuProps["items"] = [
    {
      key: "image",
      label: fr.media.image,
      icon: <PictureOutlined />,
    },
    {
      key: "video",
      label: fr.media.video,
      icon: <CaretRightOutlined />,
    },
    {
      key: "map",
      label: fr.media.map,
      icon: <GlobalOutlined />,
    },
  ];

  const handleMenuClick: MenuProps["onClick"] = (item) => {
    if (item.key === "image") {
      setAddType("image");
      setIsEditAssetOpen(true);
    } else if (item.key === "video") {
      setAddType("video");
      setIsEditAssetOpen(true);
    } else if (item.key === "map") {
      setAddType("map");
      setIsEditAssetOpen(true);
    }
  };

  const currentType = value?.type || addType;

  return (
    <div className="relative w-full aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 flex items-center justify-center group">
      {!value ? (
        <Dropdown menu={{ items: mediaMenu, onClick: handleMenuClick }} trigger={["click"]}>
          <Button type="primary" size="small">
            <Space>
              {fr.media.addMedia}
              <DownOutlined />
            </Space>
          </Button>
        </Dropdown>
      ) : (
        <>
          {/* Render Preview Thumbnail */}
          {value.type === "image" && (
            <img
              src={value.url}
              alt="Segment asset"
              className="w-full h-full object-cover"
            />
          )}

          {value.type === "video" && (
            <div className="relative w-full h-full bg-black flex items-center justify-center">
              <video
                src={value.url}
                className="w-full h-full object-cover opacity-85"
                muted
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white">
                  <CaretRightOutlined />
                </div>
              </div>
            </div>
          )}

          {value.type === "map" && (
            <div className="w-full h-full">
              <MapComponent
                location={value.location}
                zoom={value.location.zoomStart || 5}
                styles={{ width: "100%", height: "100%", borderRadius: 0 }}
              />
            </div>
          )}

          {/* Action overlay buttons on hover */}
          {editable && (
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <Tooltip title={fr.media.editAsset}>
                <Button
                  shape="circle"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => setIsEditAssetOpen(true)}
                />
              </Tooltip>
              <Tooltip title={fr.media.removeAsset}>
                <Button
                  shape="circle"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => onChange(undefined)}
                />
              </Tooltip>
            </div>
          )}
        </>
      )}

      {/* Edit modals */}
      {isEditAssetOpen && currentType === "image" && (
        <EditImage
          image={value?.type === "image" ? value : undefined}
          onClose={() => {
            setIsEditAssetOpen(false);
            setAddType(null);
          }}
          onSave={(asset) => {
            onChange(asset);
            setIsEditAssetOpen(false);
            setAddType(null);
          }}
          alternativeMedia={allMedia}
        />
      )}

      {isEditAssetOpen && currentType === "video" && (
        <EditVideo
          video={value?.type === "video" ? value : undefined}
          onClose={() => {
            setIsEditAssetOpen(false);
            setAddType(null);
          }}
          onSave={(asset) => {
            onChange(asset);
            setIsEditAssetOpen(false);
            setAddType(null);
          }}
          alternativeMedia={allMedia}
        />
      )}

      {isEditAssetOpen && currentType === "map" && (
        <EditMap
          map={value?.type === "map" ? value : undefined}
          onClose={() => {
            setIsEditAssetOpen(false);
            setAddType(null);
          }}
          onSave={(asset) => {
            onChange(asset);
            setIsEditAssetOpen(false);
            setAddType(null);
          }}
          alternativeMedia={allMedia}
        />
      )}
    </div>
  );
};

export default MediaAsset;
