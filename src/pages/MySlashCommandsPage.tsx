import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  AlertTriangle,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Folder,
  GitBranch,
  Globe,
  Loader,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { APP_LIST } from "../context/AppContext";
import { useSlashCommands } from "../context/SlashCommandContext";
import { useToast } from "../components/ui/Toast";
import { IconButton } from "../components/ui/IconButton";
import {
  openSlashCommandWithTypora,
  readExternalSlashCommandContent,
  slashCommandExportToZip,
  slashCommandGetSourceDirPath,
  slashCommandImportFromDialog,
  slashCommandImportFromFolder,
  slashCommandInstallGlobal,
  slashCommandInstallToProject,
  slashCommandShowInFinder,
  slashCommandUninstallFromProject,
  slashCommandUninstallGlobal,
} from "../services/slashCommand";
import { showInFinder } from "../services/skill";
import type {
  CreateSlashCommandInput,
  ExternalSlashCommand,
  Provenance,
  SlashCommand,
} from "../types";
import modalStyles from "../components/layout/AppShell.module.css";
import s from "./MyLibraryPage.module.css";

type CommandTab = "enable" | "commandmd";

interface ProjectEnableState {
  projectId: string;
  projectName: string;
  projectPath: string;
  apps: Record<string, boolean>;
}

function defaultCommandContent(name: string): string {
  return `# ${name || "New Command"}\n\nDescribe what this slash command should do.`;
}

function getIconColors(name: string): { bg: string; fg: string } {
  const palettes = [
    { bg: "#6366f1", fg: "#ffffff" },
    { bg: "#22c55e", fg: "#ffffff" },
    { bg: "#ef4444", fg: "#ffffff" },
    { bg: "#06b6d4", fg: "#ffffff" },
    { bg: "#f97316", fg: "#ffffff" },
    { bg: "#ec4899", fg: "#ffffff" },
    { bg: "#8b5cf6", fg: "#ffffff" },
    { bg: "#0ea5e9", fg: "#ffffff" },
  ];
  return palettes[name.charCodeAt(0) % palettes.length];
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("zh-CN");
}

function getProvenanceBadge(provenance?: Provenance): string {
  if (!provenance) return "";
  switch (provenance.kind) {
    case "manual":
      return "";
    case "file-import":
      return "导入";
    case "external-app":
      return provenance.label || "外部导入";
    case "marketplace":
      return "市场导入";
    case "repo-source":
      return provenance.sourceName
        ? `仓库源 · ${provenance.sourceName}`
        : "仓库源导入";
    default:
      return "";
  }
}

function getAppMeta(appId: string) {
  return APP_LIST.find((app) => app.id === appId) ?? null;
}

function CommandCard({
  command,
  selected,
  onClick,
}: {
  command: SlashCommand;
  selected: boolean;
  onClick: () => void;
}) {
  const iconColors = getIconColors(command.name);
  const initial = command.name.charAt(0).toUpperCase();
  const badge = getProvenanceBadge(command.provenance);

  return (
    <div
      className={`${s.card} ${selected ? s.cardSelected : ""}`}
      onClick={onClick}
    >
      <div className={s.cardContent}>
        <div
          className={s.cardIcon}
          style={{ background: iconColors.bg, color: iconColors.fg }}
        >
          <span>{initial}</span>
        </div>
        <div className={s.cardBody}>
          <div className={s.cardHeader}>
            <span className={s.cardName}>{command.name}</span>
            {badge && (
              <span className={s.cardBadge}>
                <Globe size={10} /> {badge}
              </span>
            )}
          </div>
          <p className={s.cardDesc}>{command.description || "无描述"}</p>
          <div className={s.cardFooter}>
            <span className={s.cardSlug}>{command.slug}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExternalCommandCard({
  command,
  selected,
  onClick,
  onImport,
}: {
  command: ExternalSlashCommand;
  selected: boolean;
  onClick: () => void;
  onImport: () => void;
}) {
  const iconColors = getIconColors(command.name);
  const initial = command.name.charAt(0).toUpperCase();

  return (
    <div
      className={`${s.card} ${s.cardExternal} ${selected ? s.cardSelected : ""}`}
      onClick={onClick}
    >
      <div className={s.cardContent}>
        <div
          className={s.cardIcon}
          style={{ background: iconColors.bg, color: iconColors.fg }}
        >
          <span>{initial}</span>
        </div>
        <div className={s.cardBody}>
          <div className={s.cardHeader}>
            <span className={s.cardName}>{command.name}</span>
            <span
              className={s.cardBadgeExternal}
              style={{ cursor: "pointer" }}
              title="在 Finder 中显示"
              onClick={(e) => {
                e.stopPropagation();
                void showInFinder(command.path);
              }}
            >
              <ExternalLink size={10} /> 外部
            </span>
          </div>
          <p className={s.cardDesc}>{command.description || "无描述"}</p>
          <div className={s.cardFooter}>
            <span className={s.cardSlug}>{command.slug}</span>
          </div>
        </div>
        <button
          className={s.cardImportBtn}
          title="导入到 SkillSwitch 管理"
          onClick={(event) => {
            event.stopPropagation();
            onImport();
          }}
        >
          <Download size={14} />
        </button>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className={s.list}>
      {[1, 2, 3, 4].map((item) => (
        <div key={item} className={s.card}>
          <div className={s.cardContent}>
            <div className={s.skeletonIcon} />
            <div className={s.skeletonBody}>
              <div className={s.skeletonTitle} />
              <div className={s.skeletonDesc} />
              <div className={s.skeletonFooter} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SlashCommandDetail({
  command,
  onDelete,
  onExport,
}: {
  command: SlashCommand;
  onDelete: () => void;
  onExport: () => void;
}) {
  const { update } = useSlashCommands();
  const toast = useToast();
  const iconColors = getIconColors(command.name);
  const initial = command.name.charAt(0).toUpperCase();
  const [tab, setTab] = useState<CommandTab>("enable");
  const [content, setContent] = useState(command.content ?? "");
  const [loadingContent, setLoadingContent] = useState(false);
  const [savingContent, setSavingContent] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);

  const globalStorageKey = `slash-command-global-${command.id}`;
  const [globalApps, setGlobalAppsRaw] = useState<Record<string, boolean>>(
    () => {
      try {
        const stored = localStorage.getItem(globalStorageKey);
        if (stored) return JSON.parse(stored) as Record<string, boolean>;
      } catch {}
      return Object.fromEntries(APP_LIST.map((app) => [app.id, false]));
    }
  );

  const projectStorageKey = `slash-command-projects-${command.id}`;
  const [projectEnables, setProjectEnablesRaw] = useState<ProjectEnableState[]>(
    () => {
      try {
        const stored = localStorage.getItem(projectStorageKey);
        if (stored) return JSON.parse(stored) as ProjectEnableState[];
      } catch {}
      return [];
    }
  );

  const setGlobalApps = (
    updater:
      | Record<string, boolean>
      | ((prev: Record<string, boolean>) => Record<string, boolean>)
  ) => {
    setGlobalAppsRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try {
        localStorage.setItem(globalStorageKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const setProjectEnables = (
    updater:
      | ProjectEnableState[]
      | ((prev: ProjectEnableState[]) => ProjectEnableState[])
  ) => {
    setProjectEnablesRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try {
        localStorage.setItem(projectStorageKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    setTab("enable");
    setContent(command.content ?? "");
    setContentError(null);
  }, [command.id, command.content]);

  useEffect(() => {
    let disposed = false;

    setLoadingContent(true);
    setContentError(null);

    void slashCommandGetSourceDirPath(command.id).then(async (dirResult) => {
      if (disposed) return;
      if (!dirResult.ok) {
        setContentError(dirResult.error);
        setLoadingContent(false);
        return;
      }

      const contentResult = await readExternalSlashCommandContent(
        dirResult.value
      );
      if (disposed) return;
      if (contentResult.ok) {
        setContent(contentResult.value);
      } else {
        setContentError(contentResult.error);
      }
      setLoadingContent(false);
    });

    return () => {
      disposed = true;
    };
  }, [command.id]);

  const toggleGlobalApp = async (appId: string) => {
    const currentState = globalApps[appId] ?? false;
    const newState = !currentState;
    setGlobalApps((prev) => ({ ...prev, [appId]: newState }));

    const appLabel = APP_LIST.find((app) => app.id === appId)?.label ?? appId;
    const tid = newState
      ? toast.loading(`正在写入全局 ${appLabel}…`)
      : toast.loading(`正在移除全局 ${appLabel}…`);

    const result = newState
      ? await slashCommandInstallGlobal({
          commandId: command.id,
          apps: [appId],
        })
      : await slashCommandUninstallGlobal({
          commandId: command.id,
          apps: [appId],
        });

    if (result.ok) {
      toast.resolve(
        tid,
        "success",
        newState
          ? `已将 Slash Command 写入全局 ${appLabel}`
          : `已从全局 ${appLabel} 移除 Slash Command`
      );
      return;
    }

    toast.resolve(tid, "error", result.error);
    setGlobalApps((prev) => ({ ...prev, [appId]: currentState }));
  };

  const addProjectEnable = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "选择项目文件夹",
      });
      if (!selected) return;

      const path = selected as string;
      const folderName = path.split(/[/\\]/).pop() || "未命名项目";
      setProjectEnables((prev) => [
        ...prev,
        {
          projectId: `project-${Date.now()}`,
          projectName: folderName,
          projectPath: path,
          apps: Object.fromEntries(APP_LIST.map((app) => [app.id, false])),
        },
      ]);
      toast.success(`已添加项目「${folderName}」`);
    } catch (error) {
      toast.error(`添加项目失败：${String(error)}`);
    }
  };

  const toggleProjectApp = async (projectIdx: number, appId: string) => {
    const project = projectEnables[projectIdx];
    if (!project) return;

    const currentState = project.apps[appId] ?? false;
    const newState = !currentState;
    setProjectEnables((prev) =>
      prev.map((item, index) =>
        index !== projectIdx
          ? item
          : { ...item, apps: { ...item.apps, [appId]: newState } }
      )
    );

    const appLabel = APP_LIST.find((app) => app.id === appId)?.label ?? appId;
    const tid = newState
      ? toast.loading(`正在写入 ${appLabel}…`)
      : toast.loading(`正在移除 ${appLabel}…`);

    const result = newState
      ? await slashCommandInstallToProject({
          commandId: command.id,
          projectPath: project.projectPath,
          apps: [appId],
        })
      : await slashCommandUninstallFromProject({
          commandId: command.id,
          projectPath: project.projectPath,
          apps: [appId],
        });

    if (result.ok) {
      toast.resolve(
        tid,
        "success",
        newState
          ? `已将 Slash Command 写入 ${project.projectName} / ${appLabel}`
          : `已从 ${project.projectName} / ${appLabel} 移除 Slash Command`
      );
      return;
    }

    toast.resolve(tid, "error", result.error);
    setProjectEnables((prev) =>
      prev.map((item, index) =>
        index !== projectIdx
          ? item
          : { ...item, apps: { ...item.apps, [appId]: currentState } }
      )
    );
  };

  const removeProjectEnable = async (projectIdx: number) => {
    const project = projectEnables[projectIdx];
    if (!project) return;

    const enabledApps = Object.entries(project.apps)
      .filter(([, enabled]) => enabled)
      .map(([appId]) => appId);

    if (enabledApps.length > 0) {
      const tid = toast.loading(`正在清理 ${project.projectName} 中的命令…`);
      const result = await slashCommandUninstallFromProject({
        commandId: command.id,
        projectPath: project.projectPath,
        apps: enabledApps,
      });
      toast.resolve(
        tid,
        result.ok ? "success" : "error",
        result.ok ? "项目命令已清理" : result.error
      );
    }

    setProjectEnables((prev) =>
      prev.filter((_, index) => index !== projectIdx)
    );
  };

  const saveContent = async () => {
    setSavingContent(true);
    const result = await update({ id: command.id, content });
    setSavingContent(false);

    if (result.ok) {
      toast.success("COMMAND.md 已保存");
    } else {
      toast.error(`保存失败：${result.error}`);
    }
  };

  return (
    <div className={s.detail}>
      <div className={s.detailHeader}>
        <div className={s.detailTop}>
          <div
            className={s.detailIcon}
            style={{ background: iconColors.bg, color: iconColors.fg }}
          >
            <span>{initial}</span>
          </div>
          <div className={s.detailMeta}>
            <div className={s.detailNameRow}>
              <h2 className={s.detailName}>{command.name}</h2>
            </div>
            <p className={s.detailDesc}>{command.description || "无描述"}</p>
            <div className={s.detailMetaRow}>
              <span>
                <GitBranch size={12} /> {command.slug}
              </span>
              <span>
                <Clock size={12} /> {formatDate(command.updatedAt)}
              </span>
            </div>
          </div>
          <div className={s.detailActions}>
            <IconButton
              icon={<ExternalLink size={16} />}
              variant="default"
              title="在 Finder 中显示"
              onClick={async () => {
                const result = await slashCommandShowInFinder(command.id);
                if (!result.ok) {
                  toast.error("无法打开 Finder");
                }
              }}
              aria-label="在 Finder 中显示"
            />
            <IconButton
              icon={<Download size={16} />}
              variant="default"
              title="导出 ZIP"
              onClick={onExport}
              aria-label="导出 ZIP"
            />
            <IconButton
              icon={<Trash2 size={16} />}
              variant="danger"
              title="删除"
              onClick={onDelete}
              aria-label={`删除 ${command.name}`}
            />
          </div>
        </div>
        <div className={s.tabs}>
          {(["enable", "commandmd"] as CommandTab[]).map((item) => (
            <button
              key={item}
              className={`${s.tab} ${tab === item ? s.tabActive : ""}`}
              onClick={() => setTab(item)}
            >
              {{ enable: "启用状态", commandmd: "COMMAND.md" }[item]}
            </button>
          ))}
        </div>
      </div>

      <div className={s.detailBody}>
        {tab === "enable" && (
          <div className={s.tabContent}>
            <div className={s.enableSection}>
              <div className={s.enableSectionLabel}>
                <Globe size={14} /> 全局级别{" "}
                <span className={s.enableSectionHint}>(所有项目生效)</span>
              </div>
              <div className={s.globalApps}>
                {APP_LIST.map((app) => (
                  <label key={app.id} className={s.globalAppItem}>
                    <input
                      type="checkbox"
                      checked={!!globalApps[app.id]}
                      onChange={() => toggleGlobalApp(app.id)}
                      style={{ accentColor: app.accentColor }}
                    />
                    <div>
                      <div className={s.globalAppName}>{app.label}</div>
                      <div className={s.globalAppPath}>
                        {app.commandPathLabel}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className={s.enableSection}>
              <div className={s.enableSectionLabel}>
                <Folder size={14} /> 项目级别{" "}
                <span className={s.enableSectionHint}>(仅特定项目生效)</span>
                <button className={s.addProjectBtn} onClick={addProjectEnable}>
                  <Plus size={14} /> 添加项目
                </button>
              </div>
              <div className={s.projectList}>
                {projectEnables.map((project, index) => (
                  <div key={project.projectId} className={s.projectItem}>
                    <div className={s.projectHeader}>
                      <div className={s.projectNameWrap}>
                        <span className={s.projectName}>
                          {project.projectName}
                        </span>
                        <span className={s.projectPath}>
                          {project.projectPath}
                        </span>
                      </div>
                      <IconButton
                        icon={<X size={14} />}
                        variant="danger"
                        size="sm"
                        className={s.removeProjectBtn}
                        onClick={() => removeProjectEnable(index)}
                        aria-label={`移除项目 ${project.projectName}`}
                        title="移除项目"
                      />
                    </div>
                    <div className={s.projectApps}>
                      {APP_LIST.map((app) => (
                        <label key={app.id} className={s.projectAppItem}>
                          <input
                            type="checkbox"
                            checked={!!project.apps[app.id]}
                            onChange={() => toggleProjectApp(index, app.id)}
                            style={{ accentColor: app.accentColor }}
                          />
                          <span>{app.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                {projectEnables.length === 0 && (
                  <div className={s.noProjects}>
                    暂无项目级别配置，点击上方按钮添加
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === "commandmd" && (
          <div className={s.skillmdWrap}>
            <div className={s.skillmdHeader}>
              <div className={s.skillmdMeta}>
                <span className={s.skillmdFilename}>COMMAND.md</span>
              </div>
              <div className={s.skillmdActions}>
                <button
                  className={`${s.skillmdActionBtn} ${s.skillmdActionSecondary}`}
                  onClick={() => openSlashCommandWithTypora(command.id)}
                >
                  用Typora打开
                </button>
                <button
                  className={`${s.skillmdActionBtn} ${s.skillmdActionPrimary}`}
                  disabled={savingContent}
                  onClick={saveContent}
                >
                  {savingContent ? (
                    <Loader size={13} className={s.btnSpin} />
                  ) : (
                    <Save size={13} />
                  )}
                  保存
                </button>
              </div>
            </div>
            {loadingContent ? (
              <div className={s.skillmdLoading}>
                <Loader size={16} className={s.btnSpin} />
                <span>加载中...</span>
              </div>
            ) : contentError ? (
              <div className={s.skillmdError}>
                <AlertTriangle size={16} />
                <span>{contentError}</span>
              </div>
            ) : (
              <textarea
                className={s.skillmdEditor}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                spellCheck={false}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ExternalCommandDetail({
  command,
  onImport,
}: {
  command: ExternalSlashCommand;
  onImport: () => void;
}) {
  const iconColors = getIconColors(command.name);
  const initial = command.name.charAt(0).toUpperCase();
  const appMeta = getAppMeta(command.appId);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    readExternalSlashCommandContent(command.path)
      .then((result) => {
        if (result.ok) {
          setContent(result.value);
        } else {
          setError(result.error);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(String(err));
        setLoading(false);
      });
  }, [command.path]);

  return (
    <aside className={s.detail}>
      <div className={s.detailHeader}>
        <div className={s.detailTop}>
          <div
            className={s.detailIcon}
            style={{ background: iconColors.bg, color: iconColors.fg }}
          >
            <span>{initial}</span>
          </div>
          <div className={s.detailMeta}>
            <div className={s.detailNameRow}>
              <h2 className={s.detailName}>{command.name}</h2>
            </div>
            <p className={s.detailDesc}>{command.description || "无描述"}</p>
            <div className={s.detailMetaRow}>
              <span>
                <ExternalLink size={12} /> {appMeta?.label ?? command.appId}
              </span>
              <span>
                <GitBranch size={12} /> {command.slug}
              </span>
            </div>
          </div>
          <IconButton
            icon={<ExternalLink size={16} />}
            variant="default"
            title="在 Finder 中显示"
            onClick={() => void showInFinder(command.path)}
            aria-label="在 Finder 中显示"
          />
          <button className={s.createBtn} onClick={onImport}>
            <Download size={14} /> 导入
          </button>
        </div>
      </div>
      <div className={s.detailBody}>
        <div className={s.skillmdWrap}>
          <div className={s.skillmdHeader}>
            <div className={s.skillmdMeta}>
              <span className={s.skillmdFilename}>COMMAND.md</span>
            </div>
          </div>
          {loading ? (
            <div className={s.skillmdLoading}>
              <Loader size={16} className={s.btnSpin} />
              <span>加载中...</span>
            </div>
          ) : error ? (
            <div className={s.skillmdError}>
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          ) : (
            <pre className={s.skillmdCode}>{content}</pre>
          )}
        </div>
      </div>
    </aside>
  );
}

function CreateSlashCommandModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (input: CreateSlashCommandInput) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [content, setContent] = useState(defaultCommandContent(""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  useEffect(() => {
    if (content === defaultCommandContent("")) {
      setContent(defaultCommandContent(name));
    }
  }, [content, name]);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("请输入命令名称");
      return;
    }

    setSaving(true);
    setError(null);
    await onCreate({
      name: trimmedName,
      description: description.trim() || null,
      content,
      directories: [],
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      projectIds: [],
    });
    setSaving(false);
  };

  return (
    <div className={modalStyles.modalOverlay} onClick={onClose}>
      <div
        className={modalStyles.modal}
        onClick={(event) => event.stopPropagation()}
        style={{ width: 720 }}
      >
        <div className={modalStyles.modalHeader}>
          <span className={modalStyles.modalTitle}>创建 Slash Command</span>
          <button className={modalStyles.modalClose} onClick={onClose}>
            <X size={14} />
          </button>
        </div>
        <div className={modalStyles.modalBody}>
          <div className={modalStyles.modalLabel}>名称</div>
          <input
            ref={nameRef}
            className={`${modalStyles.modalInput} ${error ? modalStyles.modalInputError : ""}`}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
            placeholder="deploy-check"
          />
          <div className={modalStyles.modalLabel} style={{ marginTop: 12 }}>
            描述
          </div>
          <input
            className={modalStyles.modalInput}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="一句话描述这个命令"
          />
          <div className={modalStyles.modalLabel} style={{ marginTop: 12 }}>
            标签
          </div>
          <input
            className={modalStyles.modalInput}
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="git, release"
          />
          <div className={modalStyles.modalLabel} style={{ marginTop: 12 }}>
            COMMAND.md
          </div>
          <textarea
            className={s.skillmdEditor}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            spellCheck={false}
            style={{
              minHeight: 240,
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-md)",
            }}
          />
          {error && <div className={modalStyles.modalError}>{error}</div>}
        </div>
        <div className={modalStyles.modalFooter}>
          <button className={modalStyles.modalCancelBtn} onClick={onClose}>
            取消
          </button>
          <button
            className={modalStyles.modalAddBtn}
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? <Loader size={12} className={s.btnSpin} /> : null}
            创建
          </button>
        </div>
      </div>
    </div>
  );
}

export function MySlashCommandsPage({
  activeCommandMode,
  onToggleCommandMode,
  onNavigateToSelfCreated,
}: {
  activeCommandMode: "self-created" | "external";
  onToggleCommandMode: () => void;
  onNavigateToSelfCreated: () => void;
}) {
  const {
    commands,
    externalCommands,
    loading,
    error,
    search,
    refresh,
    create,
    remove,
  } = useSlashCommands();
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedExternalKey, setSelectedExternalKey] = useState<string | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [importing, setImporting] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      search(searchQuery);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, search]);

  const filteredCommands = useMemo(() => {
    if (!searchQuery.trim()) {
      return commands;
    }
    const query = searchQuery.toLowerCase();
    return commands.filter(
      (command) =>
        command.name.toLowerCase().includes(query) ||
        command.slug.toLowerCase().includes(query) ||
        (command.description?.toLowerCase().includes(query) ?? false)
    );
  }, [commands, searchQuery]);

  const filteredExternalCommands = useMemo(() => {
    if (!searchQuery.trim()) {
      return externalCommands;
    }
    const query = searchQuery.toLowerCase();
    return externalCommands.filter((command) => {
      const appLabel = getAppMeta(command.appId)?.label.toLowerCase() ?? "";
      return (
        command.name.toLowerCase().includes(query) ||
        command.slug.toLowerCase().includes(query) ||
        (command.description?.toLowerCase().includes(query) ?? false) ||
        appLabel.includes(query)
      );
    });
  }, [externalCommands, searchQuery]);

  const selectedCommand =
    activeCommandMode === "external"
      ? null
      : (commands.find((command) => command.id === selectedId) ?? null);
  const selectedExternal =
    activeCommandMode === "external" && selectedExternalKey
      ? (externalCommands.find(
          (command) =>
            `${command.appId}:${command.slug}` === selectedExternalKey
        ) ?? null)
      : null;

  useEffect(() => {
    if (activeCommandMode === "external") return;
    if (filteredCommands.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!filteredCommands.some((command) => command.id === selectedId)) {
      setSelectedId(filteredCommands[0].id);
    }
  }, [filteredCommands, selectedId, activeCommandMode]);

  useEffect(() => {
    if (activeCommandMode !== "external") {
      setSelectedExternalKey(null);
      return;
    }
    if (filteredExternalCommands.length === 0) {
      setSelectedExternalKey(null);
      return;
    }
    if (
      !filteredExternalCommands.some(
        (command) => `${command.appId}:${command.slug}` === selectedExternalKey
      )
    ) {
      const first = filteredExternalCommands[0];
      setSelectedExternalKey(`${first.appId}:${first.slug}`);
    }
  }, [filteredExternalCommands, selectedExternalKey, activeCommandMode]);

  const handleCreate = async (input: CreateSlashCommandInput) => {
    const result = await create(input);
    if (result.ok) {
      toast.success(`「${result.value.command.name}」已创建`);
      setShowCreateModal(false);
      onNavigateToSelfCreated();
      setSelectedId(result.value.command.id);
    } else {
      toast.error(`创建失败：${result.error}`);
    }
  };

  const handleDelete = useCallback(async () => {
    if (!selectedCommand) return;
    const confirmed = window.confirm(
      `删除 Slash Command「${selectedCommand.name}」？`
    );
    if (!confirmed) return;

    const tid = toast.loading(`正在删除「${selectedCommand.name}」…`);
    const success = await remove(selectedCommand.id);
    if (success) {
      toast.resolve(tid, "success", "已删除");
      setSelectedId(filteredCommands[0]?.id ?? null);
    } else {
      toast.resolve(tid, "error", "删除失败");
    }
  }, [filteredCommands, remove, selectedCommand, toast]);

  const handleImport = useCallback(async () => {
    if (importing) return;
    setImporting(true);
    const tid = toast.loading("请选择 Slash Command 文件夹或 ZIP 包...");

    try {
      const result = await slashCommandImportFromDialog();
      if (!result.ok) {
        toast.resolve(tid, "error", result.error);
        return;
      }
      if (!result.value) {
        toast.dismiss(tid);
        return;
      }
      toast.resolve(tid, "success", `「${result.value.name}」导入成功`);
      await refresh();
      onNavigateToSelfCreated();
      setSelectedId(result.value.id);
    } catch (err) {
      toast.resolve(tid, "error", `导入失败：${String(err)}`);
    } finally {
      setImporting(false);
    }
  }, [importing, refresh, toast]);

  const handleImportExternal = useCallback(
    async (command: ExternalSlashCommand) => {
      setImporting(true);
      const tid = toast.loading(`正在导入「${command.name}」...`);
      const result = await slashCommandImportFromFolder(command.path);
      setImporting(false);

      if (result.ok) {
        toast.resolve(tid, "success", `「${result.value.name}」已导入`);
        await refresh();
        onNavigateToSelfCreated();
        setSelectedId(result.value.id);
      } else {
        toast.resolve(tid, "error", result.error);
      }
    },
    [refresh, toast]
  );

  const handleExport = useCallback(async () => {
    if (!selectedCommand) return;
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "选择导出目录",
      });
      if (!selected) return;

      const exportPath = `${selected}/${selectedCommand.slug}.zip`;
      const tid = toast.loading("正在导出 ZIP...");
      const result = await slashCommandExportToZip(
        selectedCommand.id,
        exportPath
      );
      toast.resolve(
        tid,
        result.ok ? "success" : "error",
        result.ok ? `已导出到 ${result.value}` : result.error
      );
    } catch (err) {
      toast.error(`导出失败：${String(err)}`);
    }
  }, [selectedCommand, toast]);

  const renderList = () => {
    if (activeCommandMode === "external") {
      if (filteredExternalCommands.length === 0) {
        return (
          <div className={s.empty}>
            {searchQuery
              ? "外部 Commands 中未找到匹配项"
              : "还没有发现可导入的外部 Commands"}
          </div>
        );
      }

      return filteredExternalCommands.map((command) => {
        const key = `${command.appId}:${command.slug}`;
        return (
          <ExternalCommandCard
            key={key}
            command={command}
            selected={selectedExternalKey === key}
            onClick={() => setSelectedExternalKey(key)}
            onImport={() => handleImportExternal(command)}
          />
        );
      });
    }

    if (filteredCommands.length === 0) {
      return (
        <div className={s.empty}>
          {searchQuery
            ? "自建 Commands 中未找到匹配项"
            : "还没有 Command，点击「创建」添加"}
        </div>
      );
    }

    return filteredCommands.map((command) => (
      <CommandCard
        key={command.id}
        command={command}
        selected={selectedId === command.id}
        onClick={() => setSelectedId(command.id)}
      />
    ));
  };

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div className={s.headerLeft}>
          <h1 className={s.headerTitle}>
            {activeCommandMode === "external"
              ? "外部 Commands"
              : "自建 Commands"}
          </h1>
          <span className={s.headerSub}>
            {activeCommandMode === "external"
              ? `${filteredExternalCommands.length} 个`
              : `${filteredCommands.length} 个`}
          </span>
        </div>
        <div className={s.headerRight}>
          <button className={s.importBtn} onClick={onToggleCommandMode}>
            {activeCommandMode === "external" ? "自建" : "外部"}
          </button>
          <div className={s.searchWrap}>
            <Search size={14} className={s.searchIcon} />
            <input
              className={s.search}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="搜索 Commands..."
            />
          </div>
          <button
            className={s.importBtn}
            onClick={() => void handleImport()}
            disabled={importing}
          >
            {importing ? (
              <>
                <Loader size={12} className={s.btnSpin} /> 导入中
              </>
            ) : (
              "导入"
            )}
          </button>
          <button
            className={s.createBtn}
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={14} /> 创建 Command
          </button>
        </div>
      </header>

      {error && (
        <div className={s.errorBanner}>
          <span>
            <AlertTriangle size={14} /> {error}
          </span>
          <button onClick={() => window.location.reload()}>重试</button>
        </div>
      )}

      <div className={s.body}>
        {loading ? (
          <LoadingSkeleton />
        ) : (
          <div className={s.list}>
            <div className={s.groupTabPanel}>{renderList()}</div>
          </div>
        )}

        {selectedCommand && (
          <SlashCommandDetail
            key={selectedCommand.id}
            command={selectedCommand}
            onDelete={handleDelete}
            onExport={handleExport}
          />
        )}
        {!selectedCommand &&
          activeCommandMode === "external" &&
          selectedExternal && (
            <ExternalCommandDetail
              key={`${selectedExternal.appId}:${selectedExternal.slug}`}
              command={selectedExternal}
              onImport={() => handleImportExternal(selectedExternal)}
            />
          )}
        {!selectedCommand &&
          (activeCommandMode !== "external" || !selectedExternal) && (
            <div className={s.detailPlaceholder}>
              <div className={s.detailPlaceholderIcon}>
                <FileText size={18} />
              </div>
              <div className={s.detailPlaceholderTitle}>Commands</div>
              <div className={s.detailPlaceholderHint}>
                选择一个命令查看启用状态和 COMMAND.md。
              </div>
            </div>
          )}
      </div>

      {showCreateModal && (
        <CreateSlashCommandModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}
