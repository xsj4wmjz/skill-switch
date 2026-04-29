import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type {
  CreateSlashCommandInput,
  CreateSlashCommandResult,
  ExternalSlashCommand,
  SlashCommand,
  UpdateSlashCommandInput,
} from "../types";
import {
  scanExternalSlashCommands,
  slashCommandCreate,
  slashCommandDelete,
  slashCommandList,
  slashCommandSearch,
  slashCommandSyncFromSource,
  slashCommandUpdate,
} from "../services/slashCommand";
import { APP_LIST } from "./AppContext";
import type { Result } from "../services/tauri";

interface SlashCommandContextValue {
  commands: SlashCommand[];
  externalCommands: ExternalSlashCommand[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  search: (query: string) => Promise<void>;
  create: (
    input: CreateSlashCommandInput
  ) => Promise<Result<CreateSlashCommandResult>>;
  update: (input: UpdateSlashCommandInput) => Promise<Result<SlashCommand>>;
  syncFromSource: (id: string) => Promise<Result<SlashCommand>>;
  remove: (id: string) => Promise<boolean>;
}

const SlashCommandContext = createContext<SlashCommandContextValue | null>(
  null
);

export function SlashCommandProvider({ children }: { children: ReactNode }) {
  const [commands, setCommands] = useState<SlashCommand[]>([]);
  const [externalCommands, setExternalCommands] = useState<
    ExternalSlashCommand[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [managedResult, externalResults] = await Promise.all([
      slashCommandList(),
      Promise.allSettled(
        APP_LIST.map((app) => scanExternalSlashCommands(app.id))
      ),
    ]);

    if (managedResult.ok) {
      setCommands(managedResult.value);
    } else {
      setError(managedResult.error);
    }

    const unmanagedExternal = externalResults.flatMap((result, index) => {
      const appId = APP_LIST[index]?.id;
      if (!appId || result.status !== "fulfilled" || !result.value.ok) {
        return [];
      }

      return result.value.value.filter((command) => !command.isSymlink);
    });
    setExternalCommands(unmanagedExternal);

    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const search = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        refresh();
        return;
      }

      setLoading(true);
      setError(null);
      const result = await slashCommandSearch(query);
      if (result.ok) {
        setCommands(result.value);
      } else {
        setError(result.error);
      }
      setLoading(false);
    },
    [refresh]
  );

  const create = useCallback(
    async (
      input: CreateSlashCommandInput
    ): Promise<Result<CreateSlashCommandResult>> => {
      const result = await slashCommandCreate(input);
      if (result.ok) {
        setCommands((prev) => [...prev, result.value.command]);
        return result;
      }
      setError(result.error);
      return result;
    },
    []
  );

  const update = useCallback(
    async (input: UpdateSlashCommandInput): Promise<Result<SlashCommand>> => {
      const result = await slashCommandUpdate(input);
      if (result.ok) {
        setCommands((prev) =>
          prev.map((command) =>
            command.id === input.id ? result.value : command
          )
        );
        return result;
      }
      setError(result.error);
      return result;
    },
    []
  );

  const syncFromSource = useCallback(
    async (id: string): Promise<Result<SlashCommand>> => {
      const result = await slashCommandSyncFromSource(id);
      if (result.ok) {
        setCommands((prev) =>
          prev.map((command) => (command.id === id ? result.value : command))
        );
      }
      return result;
    },
    []
  );

  const remove = useCallback(async (id: string): Promise<boolean> => {
    const result = await slashCommandDelete(id);
    if (result.ok) {
      setCommands((prev) => prev.filter((command) => command.id !== id));
      return true;
    }
    setError(result.error);
    return false;
  }, []);

  return (
    <SlashCommandContext.Provider
      value={{
        commands,
        externalCommands,
        loading,
        error,
        refresh,
        search,
        create,
        update,
        syncFromSource,
        remove,
      }}
    >
      {children}
    </SlashCommandContext.Provider>
  );
}

export function useSlashCommands() {
  const context = useContext(SlashCommandContext);
  if (!context) {
    throw new Error("useSlashCommands must be used within SlashCommandProvider");
  }
  return context;
}
