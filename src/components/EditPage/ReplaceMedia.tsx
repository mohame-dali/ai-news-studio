import React from "react";
import { MediaAssetType } from "@/types";
import { Flex, Typography } from "antd";

interface Props {
  alternativeMedia?: MediaAssetType[];
  onSelectMedia: (asset: MediaAssetType) => void;
}

export const ReplaceMedia: React.FC<Props> = ({
  alternativeMedia = [],
  onSelectMedia,
}) => {
  if (!alternativeMedia || alternativeMedia.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
      <Typography.Text strong className="block mb-2 text-xs text-gray-500 uppercase tracking-wider">
        Médias disponibles dans l'article source :
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
                onClick={() => onSelectMedia(asset)}
              />
            );
          }
          if (asset.type === "video") {
            return (
              <div
                key={idx}
                className="w-16 h-16 bg-gray-900 rounded cursor-pointer border-2 border-transparent hover:border-blue-500 flex flex-col items-center justify-center text-white text-[10px] p-1 text-center"
                onClick={() => onSelectMedia(asset)}
              >
                <span>▶ Vidéo</span>
              </div>
            );
          }
          return (
            <div
              key={idx}
              className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded cursor-pointer border-2 border-transparent hover:border-blue-500 flex items-center justify-center text-blue-700 dark:text-blue-200 text-[10px] font-semibold"
              onClick={() => onSelectMedia(asset)}
            >
              📍 Carte
            </div>
          );
        })}
      </Flex>
    </div>
  );
};

export default ReplaceMedia;
