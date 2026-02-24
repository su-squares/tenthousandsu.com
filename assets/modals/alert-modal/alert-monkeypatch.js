(function () {
  const baseurl = window.SITE_BASEURL || '';
  const MODAL_SRC = baseurl + "/assets/modals/alert-modal/alert-modal.js";
  const nativeAlert = window.alert.bind(window);
  let modalLoadingPromise;

  function ensureModalLoaded() {
    if (window.SuAlertModal && typeof window.SuAlertModal.show === "function") {
      return Promise.resolve(window.SuAlertModal);
    }

    if (modalLoadingPromise) {
      return modalLoadingPromise;
    }

    modalLoadingPromise = new Promise(function (resolve, reject) {
      const existing = Array.from(document.querySelectorAll("script")).find(function (s) {
        return s.src && s.src.indexOf(MODAL_SRC) !== -1;
      });

      if (existing && existing.dataset.suAlertModalLoaded === "true") {
        resolve(window.SuAlertModal);
        return;
      }

      const script = existing || document.createElement("script");
      script.src = MODAL_SRC;
      script.async = false;
      script.dataset.suAlertModalLoaded = "true";
      script.onload = function () { resolve(window.SuAlertModal); };
      script.onerror = function (error) { reject(error); };

      if (!existing) {
        document.head.appendChild(script);
      }
    });

    return modalLoadingPromise;
  }

  function patchedAlert(message) {
    ensureModalLoaded()
      .then(function (modal) {
        if (modal && typeof modal.show === "function") {
          modal.show(message);
        } else {
          nativeAlert(message);
        }
      })
      .catch(function () {
        nativeAlert(message);
      });
  }

  window.__nativeAlert = nativeAlert;
  window.alert = patchedAlert;

  ensureModalLoaded();
})();
