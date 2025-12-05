/**
 * Basic pixel and layout information for Su Squares.
 */
const INDIVIDUAL_SQUARE_EDGE_PIXELS = 10;
const COMPOSITE_SQUARE_EDGE_SQUARES = 100;
const NUM_SQUARES = COMPOSITE_SQUARE_EDGE_SQUARES * COMPOSITE_SQUARE_EDGE_SQUARES;
const CENTER_SQUARES = [4950, 4951, 5050, 5051];

function row(squareNumber) {
  return Math.floor((squareNumber - 1) / COMPOSITE_SQUARE_EDGE_SQUARES) + 1;
}

function column(squareNumber) {
  return ((squareNumber - 1) % COMPOSITE_SQUARE_EDGE_SQUARES) + 1;
}

function manhattanDistance(squareNumber1, squareNumber2) {
  return Math.abs(row(squareNumber1) - row(squareNumber2)) + Math.abs(column(squareNumber1) - column(squareNumber2));
}

function manhattanDistanceToCenter(squareNumber) {
  return Math.min(...CENTER_SQUARES.map((centerSquare) => manhattanDistance(centerSquare, squareNumber)));
}

export { INDIVIDUAL_SQUARE_EDGE_PIXELS, COMPOSITE_SQUARE_EDGE_SQUARES, NUM_SQUARES, row, column, manhattanDistanceToCenter };
