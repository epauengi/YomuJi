import { MAX_ANKI_PACKAGE_BYTES, parseAnkiPackage } from "./ankiPackage";

self.onmessage = async (event: MessageEvent<File>) => {
  const file = event.data;
  if (!(file instanceof File)) {
    self.postMessage({ ok: false, error: "Vui lòng chọn tệp Anki hợp lệ." });
    return;
  }
  if (file.size > MAX_ANKI_PACKAGE_BYTES) {
    self.postMessage({ ok: false, error: "Tệp Anki vượt quá 50 MiB." });
    return;
  }
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    self.postMessage({ ok: false, error: "Không thể đọc tệp Anki." });
    return;
  }
  try {
    const data = await parseAnkiPackage(bytes);
    self.postMessage({ ok: true, data });
  } catch (error) {
    self.postMessage({
      ok: false,
      error: error instanceof Error
        ? error.message
        : "Không thể đọc gói Anki. Hãy kiểm tra tệp rồi thử lại.",
    });
  }
};
