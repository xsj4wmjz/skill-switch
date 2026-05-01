import { useState } from "react";
import { AppShell } from "./components/layout/AppShell";
import { MyLibraryPage } from "./pages/MyLibraryPage";
import { MySlashCommandsPage } from "./pages/MySlashCommandsPage";
import { RepoBrowsePage } from "./pages/RepoBrowsePage";
import { CreatePage } from "./pages/CreatePage";
import { SettingsPage } from "./pages/SettingsPage";
import { AppProvider } from "./context/AppContext";
import { SkillProvider } from "./context/SkillContext";
import { SlashCommandProvider } from "./context/SlashCommandContext";
import { ProjectProvider } from "./context/ProjectContext";
import { SettingsProvider, useSettings } from "./context/SettingsContext";
import { SourceProvider } from "./context/SourceContext";
import { UpdaterProvider } from "./context/UpdaterContext";
import { ToastProvider } from "./components/ui/Toast";
import { ToastContainer } from "./components/ui/ToastContainer";
import { UpdateNotification } from "./components/ui/UpdateNotification";
import { BackupSetupModal } from "./components/ui/BackupSetupModal";
import "./App.css";

export type PageId =
  | "my-library"
  | "my-commands"
  | "repo-browse"
  | "create"
  | "settings";
export type LibraryTab = "self-created" | "external";
export type CommandMode = "self-created" | "external";

function BackupGate({ children }: { children: React.ReactNode }) {
  const { settings, loading } = useSettings();
  const [ready, setReady] = useState(false);

  if (loading) return null;

  if (!ready && !settings.backupSource) {
    return <BackupSetupModal onConnected={() => setReady(true)} />;
  }

  return <>{children}</>;
}

export default function App() {
  const [activePage, setActivePage] = useState<PageId>("my-library");
  const [activeRepoId, setActiveRepoId] = useState<string | null>(null);
  const [activeLibraryTab, setActiveLibraryTab] =
    useState<LibraryTab>("self-created");
  const [activeCommandMode, setActiveCommandMode] =
    useState<CommandMode>("self-created");
  const [externalAppFilter, setExternalAppFilter] = useState<string | null>(
    null
  );

  const navigateToRepo = (repoId: string) => {
    setActiveRepoId(repoId);
    setActivePage("repo-browse");
  };

  const navigateToLibraryTab = (tab: LibraryTab) => {
    setActiveLibraryTab(tab);
    setActivePage("my-library");
    if (tab !== "external") {
      setExternalAppFilter(null);
    }
  };

  const navigateToExternalApp = (appId: string) => {
    setActiveLibraryTab("external");
    setExternalAppFilter(appId);
    setActivePage("my-library");
  };

  const renderPage = () => {
    switch (activePage) {
      case "my-library":
        return (
          <MyLibraryPage
            onNavigate={setActivePage}
            activeLibraryTab={activeLibraryTab}
            externalAppFilter={externalAppFilter}
          />
        );
      case "my-commands":
        return (
          <MySlashCommandsPage
            activeCommandMode={activeCommandMode}
            onToggleCommandMode={() =>
              setActiveCommandMode((prev) =>
                prev === "self-created" ? "external" : "self-created"
              )
            }
            onNavigateToSelfCreated={() => setActiveCommandMode("self-created")}
          />
        );
      case "repo-browse":
        return <RepoBrowsePage repoId={activeRepoId ?? ""} />;
      case "create":
        return <CreatePage onNavigate={setActivePage} />;
      case "settings":
        return <SettingsPage />;
    }
  };

  return (
    <AppProvider>
      <SettingsProvider>
        <ToastProvider>
          <BackupGate>
            <SourceProvider>
              <SkillProvider>
                <SlashCommandProvider>
                  <ProjectProvider>
                    <UpdaterProvider>
                      <AppShell
                        activePage={activePage}
                        activeRepoId={activeRepoId}
                        activeLibraryTab={activeLibraryTab}
                        activeCommandMode={activeCommandMode}
                        externalAppFilter={externalAppFilter}
                        onNavigate={setActivePage}
                        onNavigateRepo={navigateToRepo}
                        onNavigateLibraryTab={navigateToLibraryTab}
                        onNavigateExternalApp={navigateToExternalApp}
                        onToggleCommandMode={() =>
                          setActiveCommandMode((prev) =>
                            prev === "self-created"
                              ? "external"
                              : "self-created"
                          )
                        }
                      >
                        {renderPage()}
                      </AppShell>
                      <ToastContainer />
                      <UpdateNotification />
                    </UpdaterProvider>
                  </ProjectProvider>
                </SlashCommandProvider>
              </SkillProvider>
            </SourceProvider>
          </BackupGate>
        </ToastProvider>
      </SettingsProvider>
    </AppProvider>
  );
}
