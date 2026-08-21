import { BOARD_HEIGHT, BOARD_WIDTH, NORMAL_COLUMNS } from "./config.js?v=20260821-40";

export function createBoard() {
  return Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null));
}

export function isNormalBottomRowFull(board) {
  return board[BOARD_HEIGHT - 1].slice(0, NORMAL_COLUMNS).every(Boolean);
}

export function settleBoard(board) {
  for (let x = 0; x < BOARD_WIDTH; x += 1) {
    const column = [];

    for (let y = BOARD_HEIGHT - 1; y >= 0; y -= 1) {
      if (board[y][x]) column.push(board[y][x]);
      board[y][x] = null;
    }

    column.forEach((block, index) => {
      board[BOARD_HEIGHT - 1 - index][x] = block;
    });
  }
}

export function collides(board, piece, minX, maxX) {
  let blocked = false;

  piece.blocks.forEach((block) => {
    if (block.x < minX || block.x > maxX || block.y >= BOARD_HEIGHT || (block.y >= 0 && board[block.y][block.x])) {
      blocked = true;
    }
  });

  return blocked;
}

export function shiftPiece(piece, dx, dy) {
  return {
    ...piece,
    blocks: piece.blocks.map((block) => ({
      ...block,
      x: block.x + dx,
      y: block.y + dy,
    })),
  };
}

export function rotatePiece(piece) {
  const pivot = piece.blocks[0];

  return {
    ...piece,
    blocks: piece.blocks.map((block) => {
      const relativeX = block.x - pivot.x;
      const relativeY = block.y - pivot.y;

      return {
        ...block,
        x: pivot.x - relativeY,
        y: pivot.y + relativeX,
      };
    }),
  };
}
