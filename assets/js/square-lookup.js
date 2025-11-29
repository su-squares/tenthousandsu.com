import { attachListChooser } from "/assets/js/choosers/list-chooser.js";
import { attachCanvasChooser } from "/assets/js/choosers/canvas-chooser.js";
import { loadSquareData } from "/assets/js/square-data.js";

const input = document.getElementById("square-lookup-input");
const chooseButton = document.getElementById("square-lookup-choose");
const chooseCanvasButton = document.getElementById("square-lookup-canvas");
const submitButton = document.getElementById("square-lookup-submit");

if (input && chooseButton && submitButton) {
  let dataCache;

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

  attachListChooser({
    input,
    trigger: chooseButton,
    filter: (_id, ctx) => Boolean(ctx.extra),
    onSelect: (id) => {
      window.location.href = `/square#${id}`;
    },
    updateInput: false,
    title: "Choose a minted Square",
    description: "Tap a square below to look it up.",
  });

  if (chooseCanvasButton) {
    attachCanvasChooser({
      input,
      trigger: chooseCanvasButton,
      filter: (_id, ctx) => Boolean(ctx.extra),
      onSelect: (id) => {
        window.location.href = `/square#${id}`;
      },
      updateInput: false,
      title: "Choose square from canvas",
    });
  }

  submitButton.addEventListener("click", async () => {
    const result = await validateSquare();
    if (!result.ok) {
      alert(result.message);
      return;
    }
    window.location.href = `/square#${result.value}`;
  });
}
