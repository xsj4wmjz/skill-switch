import { tauriInvoke, type Result } from "./tauri";
import type {
  CreateSlashCommandInput,
  CreateSlashCommandResult,
  ExternalSlashCommand,
  SlashCommand,
  SlashCommandDirectoryInput,
  SlashCommandDirectoryListing,
  SlashCommandFileContent,
  SlashCommandFileInput,
  UpdateSlashCommandInput,
} from "../types";

export function formatSlashCommandOperationError(
  error: string,
  action: "安装" | "保存" = "安装"
): string {
  if (error.includes("library repo is not connected")) {
    return `${action}失败：我的库仓库尚未连接`;
  }

  return `${action}失败：${error}`;
}

export async function slashCommandList(): Promise<Result<SlashCommand[]>> {
  return tauriInvoke<SlashCommand[]>("slash_command_list");
}

export async function slashCommandGet(
  id: string
): Promise<Result<SlashCommand | null>> {
  return tauriInvoke<SlashCommand | null>("slash_command_get", { id });
}

export async function slashCommandCreate(
  input: CreateSlashCommandInput
): Promise<Result<CreateSlashCommandResult>> {
  return tauriInvoke<CreateSlashCommandResult>("slash_command_create", {
    input,
  });
}

export async function slashCommandUpdate(
  input: UpdateSlashCommandInput
): Promise<Result<SlashCommand>> {
  return tauriInvoke<SlashCommand>("slash_command_update", { input });
}

export async function slashCommandDelete(id: string): Promise<Result<void>> {
  return tauriInvoke<void>("slash_command_delete", { id });
}

export async function slashCommandSearch(
  query: string
): Promise<Result<SlashCommand[]>> {
  return tauriInvoke<SlashCommand[]>("slash_command_search", { query });
}

export interface InstallSlashCommandToProjectInput {
  commandId: string;
  projectPath: string;
  apps: string[];
}

export interface InstallSlashCommandToProjectResult {
  installedApps: string[];
  failedApps: string[];
}

export async function slashCommandInstallToProject(
  input: InstallSlashCommandToProjectInput
): Promise<Result<InstallSlashCommandToProjectResult>> {
  return tauriInvoke<InstallSlashCommandToProjectResult>(
    "slash_command_install_to_project",
    { input }
  );
}

export async function slashCommandUninstallFromProject(
  input: InstallSlashCommandToProjectInput
): Promise<Result<InstallSlashCommandToProjectResult>> {
  return tauriInvoke<InstallSlashCommandToProjectResult>(
    "slash_command_uninstall_from_project",
    { input }
  );
}

export interface InstallSlashCommandGlobalInput {
  commandId: string;
  apps: string[];
}

export interface InstallSlashCommandGlobalResult {
  installedApps: string[];
  failedApps: string[];
}

export async function slashCommandInstallGlobal(
  input: InstallSlashCommandGlobalInput
): Promise<Result<InstallSlashCommandGlobalResult>> {
  return tauriInvoke<InstallSlashCommandGlobalResult>(
    "slash_command_install_global",
    { input }
  );
}

export async function slashCommandUninstallGlobal(
  input: InstallSlashCommandGlobalInput
): Promise<Result<InstallSlashCommandGlobalResult>> {
  return tauriInvoke<InstallSlashCommandGlobalResult>(
    "slash_command_uninstall_global",
    { input }
  );
}

export async function slashCommandImportFromFolder(
  folderPath: string
): Promise<Result<SlashCommand>> {
  return tauriInvoke<SlashCommand>("slash_command_import_from_folder", {
    folderPath,
  });
}

export async function slashCommandImportFromDialog(): Promise<
  Result<SlashCommand | null>
> {
  return tauriInvoke<SlashCommand | null>("slash_command_import_from_dialog");
}

export async function slashCommandImportFromZip(
  zipPath: string
): Promise<Result<SlashCommand>> {
  return tauriInvoke<SlashCommand>("slash_command_import_from_zip", {
    zipPath,
  });
}

export async function slashCommandExportToZip(
  commandId: string,
  outputPath: string
): Promise<Result<string>> {
  return tauriInvoke<string>("slash_command_export_to_zip", {
    commandId,
    outputPath,
  });
}

export async function slashCommandListDirectory(
  input: SlashCommandDirectoryInput
): Promise<Result<SlashCommandDirectoryListing>> {
  return tauriInvoke<SlashCommandDirectoryListing>(
    "slash_command_list_directory",
    { input }
  );
}

export async function slashCommandReadFile(
  input: SlashCommandFileInput
): Promise<Result<SlashCommandFileContent>> {
  return tauriInvoke<SlashCommandFileContent>("slash_command_read_file", {
    input,
  });
}

export async function slashCommandShowInFinder(
  commandId: string
): Promise<Result<void>> {
  return tauriInvoke<void>("slash_command_show_in_finder", { commandId });
}

export async function scanExternalSlashCommands(
  appId: string
): Promise<Result<ExternalSlashCommand[]>> {
  return tauriInvoke<ExternalSlashCommand[]>("scan_external_slash_commands", {
    appId,
  });
}

export async function readExternalSlashCommandContent(
  path: string
): Promise<Result<string>> {
  return tauriInvoke<string>("read_external_slash_command_content", { path });
}

export async function slashCommandGetSourceDirPath(
  commandId: string
): Promise<Result<string>> {
  return tauriInvoke<string>("slash_command_source_dir_path", { commandId });
}

export async function openSlashCommandWithTypora(
  commandId: string
): Promise<Result<void>> {
  return tauriInvoke<void>("open_slash_command_with_typora", { commandId });
}

export async function slashCommandSyncFromSource(
  commandId: string
): Promise<Result<SlashCommand>> {
  return tauriInvoke<SlashCommand>("slash_command_sync_from_source", {
    commandId,
  });
}
