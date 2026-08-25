import { BOARD_HEIGHT, BOARD_WIDTH, NORMAL_COLUMNS } from "./config.js?v=20260824-3";

export function createBoard() {
  return Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null));
}

export function isNormalBottomRowFull(board) {
  return board[BOARD_HEIGHT - 1].slice(0, NORMAL_COLUMNS).every(Boolean);
}

export function settleBoard(board) {
  return settleBoardColumns(board, 0, BOARD_WIDTH - 1);
}

export function settleBoardColumns(board, startX, endX) {
  const movements = [];

  for (let x = startX; x <= endX; x += 1) {
    const column = [];

    for (let y = BOARD_HEIGHT - 1; y >= 0; y -= 1) {
      if (board[y][x]) column.push({ block: board[y][x], fromY: y });
      board[y][x] = null;
    }

    column.forEach(({ block, fromY }, index) => {
      const toY = BOARD_HEIGHT - 1 - index;
      board[toY][x] = block;
      if (fromY !== toY) movements.push({ block, x, fromY, toY });
    });
  }

  return movements;
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

export function getLandingPiece(board, piece, minX, maxX) {
  let landing = piece;
  let next = shiftPiece(landing, 0, 1);

  while (!collides(board, next, minX, maxX)) {
    landing = next;
    next = shiftPiece(landing, 0, 1);
  }

  return landing;
}

export function getSettledLandingPiece(board, piece, minX, maxX) {
  const landing = getLandingPiece(board, piece, minX, maxX);
  const previewBoard = board.map((row) => [...row]);
  const previewBlocks = landing.blocks.map((block) => ({ ...block }));

  previewBlocks.forEach((block) => {
    if (block.y >= 0) previewBoard[block.y][block.x] = block;
  });
  settleBoardColumns(previewBoard, minX, maxX);

  return {
    ...landing,
    blocks: previewBlocks.map((block) => {
      for (let y = 0; y < previewBoard.length; y += 1) {
        if (previewBoard[y][block.x] === block) return { ...block, y };
      }
      return block;
    }),
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
