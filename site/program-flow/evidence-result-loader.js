const SHA256 = /^[a-f0-9]{64}$/u;

export async function prepareEvidenceResult(image, manifest, announce) {
  const previewHash = requireHash(manifest.artifactHashes?.previewSha256, "preview");
  const resultHash = requireHash(manifest.artifactHashes?.resultSha256, "result");
  const previewSource = baseSource(image.getAttribute("src"));
  const resultSource = baseSource(image.dataset.fullResultSource);
  if (!previewSource || !resultSource) throw new Error("evidence result sources are missing");

  const versionedPreview = versionedSource(previewSource, previewHash);
  const versionedResult = versionedSource(resultSource, resultHash);
  await loadImage(image, versionedPreview, previewSource);
  markLoaded(image, "preview", previewHash, previewHash, resultHash);

  let pending = null;
  return async function ensureFullResult() {
    if (image.dataset.loadedArtifact === "result" && image.dataset.loadedSha256 === resultHash) return true;
    if (pending) return pending;
    announce("Загружаем полный результат для детального просмотра");
    pending = loadImage(image, versionedResult, versionedPreview)
      .then(() => {
        markLoaded(image, "result", resultHash, previewHash, resultHash);
        announce("Полный результат загружен");
        return true;
      })
      .catch(() => {
        markLoaded(image, "preview", previewHash, previewHash, resultHash);
        announce("Полный результат недоступен · быстрый просмотр сохранён");
        return false;
      })
      .finally(() => { pending = null; });
    return pending;
  };
}

function markLoaded(image, artifact, loadedHash, previewHash, resultHash) {
  image.dataset.loadedArtifact = artifact;
  image.dataset.loadedSha256 = loadedHash;
  image.dataset.previewSha256 = previewHash;
  image.dataset.resultSha256 = resultHash;
}

function loadImage(image, source, fallbackSource) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      image.removeEventListener("load", loaded);
      image.removeEventListener("error", failed);
    };
    const loaded = () => {
      cleanup();
      resolve();
    };
    const failed = () => {
      cleanup();
      if (image.getAttribute("src") !== fallbackSource) image.src = fallbackSource;
      reject(new Error(`evidence image is unavailable: ${source}`));
    };
    image.addEventListener("load", loaded, { once: true });
    image.addEventListener("error", failed, { once: true });
    if (image.getAttribute("src") !== source) image.src = source;
    if (image.complete && image.naturalWidth > 0) loaded();
    else if (image.complete) failed();
  });
}

function versionedSource(source, hash) {
  return `${source}?sha256=${encodeURIComponent(hash)}`;
}

function baseSource(source) {
  return source?.split("?", 1)[0] || "";
}

function requireHash(value, label) {
  if (typeof value !== "string" || !SHA256.test(value)) throw new Error(`${label} result hash is missing`);
  return value;
}
