import fs from "fs";
import { row, column, manhattanDistanceToCenter } from "./geometry.mjs";

function numberOfPrimeDivisorsCountedWithMultiplicity(integer) {
  let count = 0;
  let divisor = 2;
  while (integer > 1) {
    if (integer % divisor === 0) {
      count += 1;
      integer /= divisor;
    } else {
      divisor += 1;
    }
  }
  return count;
}

function palindromeClassification(integer) {
  const str = integer.toString();
  if (str.split("").every((digit) => digit === str[0])) {
    return "ALL SAME DIGIT";
  }
  if (str === str.split("").reverse().join("")) {
    return "PALINDROME";
  }
  return "NOT A PALINDROME";
}

/**
 * Publish a personalization to a metadata directory.
 * @param {Object} options
 * @param {number} options.squareNumber
 * @param {string} [options.title]
 * @param {string} options.metadataDir
 * @param {string} options.tokenUriBase
 * @param {string} options.siteBase
 */
function publishMetadataJson({ squareNumber, title = "Available for sale", metadataDir, tokenUriBase, siteBase }) {
  const paddedSquareNumber = ("00000" + squareNumber).slice(-5);
  const sanitizedBase = tokenUriBase.endsWith("/") ? tokenUriBase : `${tokenUriBase}/`;
  const metadata = {
    name: `Square #${squareNumber}`,
    description: title,
    image: `${sanitizedBase}${paddedSquareNumber}.svg`,
    external_url: `${siteBase.replace(/\/$/, "")}/square#${paddedSquareNumber}`,
    attributes: [
      { trait_type: "Row", value: row(squareNumber) },
      { trait_type: "Column", value: column(squareNumber) },
      { trait_type: "Manhattan distance to center", value: manhattanDistanceToCenter(squareNumber) },
      { trait_type: "Prime divisors", value: numberOfPrimeDivisorsCountedWithMultiplicity(squareNumber) },
      { trait_type: "Palindrome", value: palindromeClassification(squareNumber) },
    ],
  };
  const metadataFile = `${metadataDir}/${paddedSquareNumber}.json`;
  fs.writeFileSync(metadataFile, JSON.stringify(metadata));
}

export { publishMetadataJson };
