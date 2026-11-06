// The About tab's Details, as the prototype: title, game system and join
// screen (each changed in place, saved through Foundry's editWorld), then
// what Foundry knows: made for, last saved with, played for, size, folder
// and last played.
import type { WorldInfo } from "@module-library/shared/world";
import type { BackupInfo } from "../../../../page-backups.ts";
import { IconButton } from "../../../common/widgets.tsx";
import { useUi } from "../../../context.ts";
import { systemTitle } from "../../../model/system.ts";
import { useLastPlayed } from "../../WorldRail.tsx";
import { useSave } from "../AboutEdit.tsx";
import { formatSize } from "../BackupsTab.tsx";
import { latestBackup } from "../useBackups.ts";
import { EditRow } from "./EditRow.tsx";
import { isOlder, madeFor, playedFor } from "./format.ts";

type Theme = "default" | "minimal";
const THEMES: readonly Theme[] = ["default", "minimal"];

function SavedWith(props: { readonly world: WorldInfo }) {
  const { state, t } = useUi();
  const generation = state.data.setup?.core.generation ?? 0;
  return (
    <>
      {t("about.savedWith", { version: props.world.coreVersion })}
      {isOlder(props.world.coreVersion, generation) ? (
        <span class="mlw-pill warn">{t("about.older")}</span>
      ) : null}
    </>
  );
}

function Folder(props: { readonly id: string }) {
  const { actions, t } = useUi();
  const path = `worlds/${props.id}`;
  return (
    <>
      <code>{path}</code>
      <IconButton
        icon="copy"
        label={t("about.copyPath")}
        onClick={() => {
          void navigator.clipboard.writeText(path).catch(() => {
            actions.notify("info", path);
          });
        }}
      />
    </>
  );
}

function Size(props: { readonly backups: readonly BackupInfo[] | undefined }) {
  const { t } = useUi();
  const latest = latestBackup(props.backups);
  if (!latest) return <span class="ml-muted">{t("about.sizeUnknown")}</span>;
  return (
    <>
      {t("about.sizeAt", { size: formatSize(latest.size) })}{" "}
      <span class="ml-muted">{t("about.sizeAtHint")}</span>
    </>
  );
}

interface RowProps {
  readonly world: WorldInfo;
  readonly canEdit: boolean;
}

function TitleRow(props: RowProps) {
  const { t } = useUi();
  const save = useSave(props.world.id);
  return (
    <EditRow<string>
      label={t("about.title")}
      view={props.world.title}
      {...(props.canEdit && {
        edit: {
          link: t("about.rename"),
          linkLabel: t("about.rename"),
          initial: props.world.title,
          editor: (p) => (
            <input
              type="text"
              aria-label={t("about.title")}
              value={p.value}
              onInput={(e) => p.onValue(e.currentTarget.value)}
            />
          ),
          save: (title) =>
            title.trim()
              ? save({ title: title.trim() })
              : Promise.resolve(false),
        },
      })}
    />
  );
}

function SystemRow(props: RowProps) {
  const { state, t } = useUi();
  const { world } = props;
  const save = useSave(world.id);
  const systems = state.data.setup?.systems ?? [];
  return (
    <EditRow<string>
      label={t("about.system")}
      view={`${systemTitle(state.data.setup, world.system)} ${world.systemVersion}`}
      {...(props.canEdit && {
        edit: {
          link: t("about.change"),
          linkLabel: t("about.changeSystem"),
          initial: world.system,
          editor: (p) => (
            <>
              <select
                aria-label={t("about.system")}
                value={p.value}
                onChange={(e) => p.onValue(e.currentTarget.value)}
              >
                {systems.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} {s.version}
                  </option>
                ))}
              </select>
              <p class="warnline">{t("about.systemWarn")}</p>
            </>
          ),
          save: (system) =>
            system === world.system ? Promise.resolve(true) : save({ system }),
        },
      })}
    />
  );
}

function ThemeRow(props: RowProps) {
  const { t } = useUi();
  const save = useSave(props.world.id);
  const theme: Theme = props.world.joinTheme ?? "default";
  return (
    <EditRow<Theme>
      label={t("about.theme")}
      view={t(`about.theme.${theme}`)}
      {...(props.canEdit && {
        edit: {
          link: t("about.change"),
          linkLabel: t("about.changeTheme"),
          initial: theme,
          editor: (p) => (
            <select
              aria-label={t("about.theme")}
              value={p.value}
              onChange={(e) => p.onValue(e.currentTarget.value as Theme)}
            >
              {THEMES.map((k) => (
                <option key={k} value={k}>
                  {t(`about.theme.${k}`)}
                </option>
              ))}
            </select>
          ),
          save: (joinTheme) => save({ joinTheme }),
        },
      })}
    />
  );
}

export function Details(props: {
  readonly world: WorldInfo;
  readonly canEdit: boolean;
  readonly backups: readonly BackupInfo[] | undefined;
}) {
  const { t } = useUi();
  const { world } = props;
  const lastPlayed = useLastPlayed();
  return (
    <section class="mlw-box">
      <h4>
        <span>{t("about.details")}</span>
      </h4>
      <dl class="mlw-details">
        <TitleRow world={world} canEdit={props.canEdit} />
        <SystemRow world={world} canEdit={props.canEdit} />
        <ThemeRow world={world} canEdit={props.canEdit} />
        <dt>{t("about.madeFor")}</dt>
        <dd>{madeFor(t, world.verified)}</dd>
        <dt>{t("about.lastSaved")}</dt>
        <dd>
          <SavedWith world={world} />
        </dd>
        <dt>{t("about.playedFor")}</dt>
        <dd>{playedFor(t, world.playtime)}</dd>
        <dt>{t("about.size")}</dt>
        <dd>
          <Size backups={props.backups} />
        </dd>
        <dt>{t("about.folder")}</dt>
        <dd>
          <Folder id={world.id} />
        </dd>
        <dt>{t("about.lastPlayed")}</dt>
        <dd>{lastPlayed(world)}</dd>
      </dl>
    </section>
  );
}
