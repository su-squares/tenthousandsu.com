(function () {
  function getModal() {
    return window.SuLeavingModal;
  }

  function guardLink(anchor, targetAttr) {
    if (!anchor) {
      return;
    }

    const modal = getModal();
    if (!modal) {
      return;
    }

    if (targetAttr) {
      anchor.setAttribute("target", targetAttr);
    }

    modal.gateAnchor(anchor);
  }

  function guardLinks(selector, targetAttr) {
    const modal = getModal();
    if (!modal || !selector) {
      return;
    }

    modal.init();

    const anchors = typeof selector === "string"
      ? document.querySelectorAll(selector)
      : selector;

    if (!anchors || typeof anchors.forEach !== "function") {
      return;
    }

    anchors.forEach(function (anchor) {
      guardLink(anchor, targetAttr);
    });
  }

  window.SuLeavingLinkGuard = {
    guardLink,
    guardLinks,
  };
})();
