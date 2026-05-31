window.addEventListener("message", (event) => {
  if (event.source !== window) {
    return;
  }

  if (event.data?.type === "CONTENTBRIDGE_EXTENSION_PING") {
    chrome.runtime.sendMessage({ type: "CONTENTBRIDGE_EXTENSION_PING" }, (response) => {
      window.postMessage(
        {
          type: "CONTENTBRIDGE_EXTENSION_PONG",
          ok: Boolean(response?.ok),
          version: response?.version,
        },
        window.location.origin,
      );
    });
  }

  if (event.data?.type === "CONTENTBRIDGE_PUBLISH_JOBS") {
    chrome.runtime.sendMessage(
      {
        type: "CONTENTBRIDGE_PUBLISH_JOBS",
        jobs: event.data.jobs,
      },
      (response) => {
        window.postMessage(
          {
            type: "CONTENTBRIDGE_PUBLISH_ACK",
            ok: Boolean(response?.ok),
            results: response?.results ?? [],
            error: response?.error,
          },
          window.location.origin,
        );
      },
    );
  }
});
