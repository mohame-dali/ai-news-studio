import React, { useEffect, useState } from "react";
import { App as AntdApp, ConfigProvider, theme } from "antd";
import StartPage from "./components/StartPage/StartPage";
import EditPage from "./components/EditPage/EditPage";
import { initializeStorage } from "./lib/storage";

export function App() {
  const [currentPage, setCurrentPage] = useState<"start" | "edit">("start");
  const [currentGenerationId, setCurrentGenerationId] = useState<string>("arctic-climate-summit");

  useEffect(() => {
    initializeStorage();

    // Check initial path or query
    const path = window.location.pathname.replace(/^\//, "");
    const searchParams = new URLSearchParams(window.location.search);
    const genParam = searchParams.get("generation") || path;

    if (genParam && genParam !== "start" && genParam !== "") {
      setCurrentGenerationId(genParam);
      setCurrentPage("edit");
    }

    const handlePopState = () => {
      const updatedPath = window.location.pathname.replace(/^\//, "");
      const params = new URLSearchParams(window.location.search);
      const id = params.get("generation") || updatedPath;
      if (id && id !== "start" && id !== "") {
        setCurrentGenerationId(id);
        setCurrentPage("edit");
      } else {
        setCurrentPage("start");
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigateToEditor = (generationId: string) => {
    setCurrentGenerationId(generationId);
    setCurrentPage("edit");
    window.history.pushState({}, "", `/${encodeURIComponent(generationId)}`);
  };

  const navigateToStart = () => {
    setCurrentPage("start");
    window.history.pushState({}, "", "/");
  };

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: "#2563eb",
          borderRadius: 8,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        },
      }}
    >
      <AntdApp>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col">
          {currentPage === "start" ? (
            <StartPage onNavigateToEditor={navigateToEditor} />
          ) : (
            <EditPage
              generationParamId={currentGenerationId}
              onNavigateHome={navigateToStart}
            />
          )}
        </div>
      </AntdApp>
    </ConfigProvider>
  );
}

export default App;
