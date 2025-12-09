import { loadSquareData } from "./square-data.js";

const input = document.getElementById("square-lookup-input");
const chooseButton = document.getElementById("square-lookup-choose");
const chooseCanvasButton = document.getElementById("square-lookup-canvas");
const submitButton = document.getElementById("square-lookup-submit");

if (input && chooseButton && submitButton) {
  let dataCache;
  const normalizedPath = window.location.pathname.replace(/\/+$/, "").toLowerCase();
  const isSquarePage = normalizedPath.endsWith("/square") || normalizedPath.endsWith("/square.html");
  if (isSquarePage && "scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  const goToSquare = (id) => {
    const baseurl = window.SITE_BASEURL || '';
    const targetHash = `#${id}`;
    if (isSquarePage) {
      window.scrollTo(0, 0);
      window.location.hash = targetHash;
      window.location.reload();
    } else {
      window.location.href = `${baseurl}/square${targetHash}`;
    }
  };

  const requireData = async () => {
    if (dataCache) return dataCache;
    dataCache = await loadSquareData();
    return dataCache;
  };

  input.addEventListener("input", () => {
    const value = parseInt(input.value, 10);
    if (isNaN(value) || value < 1 || value > 10000) {
      input.setCustomValidity("Enter a number between 1 and 10,000.");
    } else {
      input.setCustomValidity("");
    }
  });

  const isMinted = (id, data) => {
    if (!data) return false;
    return Boolean(data.extra[id - 1]);
  };

  const validateSquare = async () => {
    const value = parseInt(input.value, 10);
    if (isNaN(value) || value < 1 || value > 10000) {
      return { ok: false, message: "Enter a number between 1 and 10,000." };
    }
    const data = await requireData();
    if (!isMinted(value, data)) {
      return { ok: false, message: "This square has not been minted, please try again with another value." };
    }
    return { ok: true, value };
  };

  let listChooserHandle;
  const ensureListChooser = async () => {
    if (listChooserHandle) return listChooserHandle;
    const module = await import("./choosers/list-chooser.js");
    listChooserHandle = module.attachListChooser({
      input,
      trigger: chooseButton,
      filter: (_id, ctx) => Boolean(ctx.extra),
      onSelect: (id) => {
        goToSquare(id);
      },
      updateInput: false,
      title: "Choose a minted Square",
      description: "Tap a square below to look it up.",
    });
    return listChooserHandle;
  };

  const handleChooseListClick = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      const chooser = await ensureListChooser();
      chooser.open();
      chooseButton.removeEventListener("click", handleChooseListClick);
    } catch (error) {
      console.error("Failed to load the list chooser", error);
      alert("Unable to open the chooser right now.");
    }
  };

  chooseButton.addEventListener("click", handleChooseListClick);

  if (chooseCanvasButton) {
    let canvasChooserHandle;
    const ensureCanvasChooser = async () => {
      if (canvasChooserHandle) return canvasChooserHandle;
      const module = await import("./choosers/canvas-chooser.js");
      canvasChooserHandle = module.attachCanvasChooser({
        input,
        trigger: chooseCanvasButton,
        filter: (_id, ctx) => Boolean(ctx.extra),
        onSelect: (id) => {
          goToSquare(id);
        },
        updateInput: false,
        title: "Choose square from canvas",
      });
      return canvasChooserHandle;
    };

    const handleChooseCanvasClick = async (event) => {
      event.preventDefault();
      event.stopPropagation();
      try {
        const chooser = await ensureCanvasChooser();
        chooser.open();
        chooseCanvasButton.removeEventListener("click", handleChooseCanvasClick);
      } catch (error) {
        console.error("Failed to load the canvas chooser", error);
        alert("Unable to open the chooser right now.");
      }
    };

    chooseCanvasButton.addEventListener("click", handleChooseCanvasClick);
  }

  submitButton.addEventListener("click", async () => {
    const result = await validateSquare();
    if (!result.ok) {
      alert(result.message);
      return;
    }
    goToSquare(result.value);
  });
}
