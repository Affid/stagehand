// File download and upload in the page.

export function downloadText(fileName: string, text: string): void {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

export function pickTextFile(): Promise<string | undefined> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(undefined);
        return;
      }
      file.text().then(resolve, () => {
        resolve(undefined);
      });
    });
    input.click();
  });
}

export const fileStamp = (date: Date): string =>
  date.toISOString().slice(0, 10);
