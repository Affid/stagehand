// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/preact";
import { afterEach, describe, expect, test, vi } from "vitest";
import { InlineInput } from "../../src/ui/common/widgets.tsx";

afterEach(cleanup);

function setup() {
  const onCommit = vi.fn();
  const onCancel = vi.fn();
  const view = render(
    <InlineInput
      initial=""
      label="Name"
      onCommit={onCommit}
      onCancel={onCancel}
    />,
  );
  const input = view.getByRole("textbox", { name: "Name" });
  return { onCommit, onCancel, input };
}

describe("InlineInput", () => {
  test("commits once on Enter, even when blur follows (no duplicate create)", () => {
    const { onCommit, input } = setup();
    fireEvent.input(input, { target: { value: "combat" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("combat");
  });

  test("Escape cancels and a later blur does not commit", () => {
    const { onCommit, onCancel, input } = setup();
    fireEvent.input(input, { target: { value: "x" } });
    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.blur(input);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
  });

  test("an empty value cancels instead of committing", () => {
    const { onCommit, onCancel, input } = setup();
    fireEvent.input(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCommit).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
