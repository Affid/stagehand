// Foundry's form, kept equal to the cards: a hidden checkbox per installed
// module, named as Foundry's own rows are. Foundry's save reads the form's
// checkboxes as the whole module list; should it ever run despite the
// guards, it saves what the cards show, never an empty list
// (docs/IN-WORLD-LIBRARY-PLAN.md, "Keeping Foundry's save safe").

export function FailSafe(props: {
  readonly installed: readonly string[];
  readonly on: ReadonlySet<string>;
}) {
  return (
    <div class="stagehand-failsafe" hidden>
      {props.installed.map((id) => (
        <input
          key={id}
          type="checkbox"
          name={id}
          checked={props.on.has(id)}
          hidden
          tabIndex={-1}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
