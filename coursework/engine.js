(function (root) {
  'use strict';

  const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];

  function readGrid(grid) {
    if (!Array.isArray(grid) || grid.length < 1 || grid.length > 100
      || typeof grid[0] !== 'string' || grid[0].length < 1 || grid[0].length > 100) {
      throw new Error('地图需要 1 至 100 行、1 至 100 列。');
    }
    const width = grid[0].length;
    for (const row of grid) {
      if (typeof row !== 'string' || row.length !== width || /[^.#STg]/.test(row)) {
        throw new Error('地图每行必须等宽，只能使用 .、#、S、T 和 g。');
      }
    }

    const tiles = grid.join('');
    const start = tiles.indexOf('S');
    const goal = tiles.indexOf('T');
    if (start < 0 || goal < 0 || start !== tiles.lastIndexOf('S') || goal !== tiles.lastIndexOf('T')) {
      throw new Error('地图必须恰好有一个起点 S 和一个终点 T。');
    }
    return { height: grid.length, width, tiles, start, goal };
  }

  function coordinates(index, width) {
    return [Math.floor(index / width), index % width];
  }

  function* neighbors(index, board) {
    const [row, col] = coordinates(index, board.width);
    for (const [dr, dc] of directions) {
      const nextRow = row + dr;
      const nextCol = col + dc;
      if (nextRow < 0 || nextRow >= board.height || nextCol < 0 || nextCol >= board.width) continue;

      const neighbor = nextRow * board.width + nextCol;
      if (board.tiles[neighbor] !== '#') yield neighbor;
    }
  }

  function addToFrame(frames, value, index, width) {
    let frame = frames[frames.length - 1];
    if (!frame || frame.value !== value) {
      frame = { value, cells: [] };
      frames.push(frame);
    }
    frame.cells.push(coordinates(index, width));
  }

  function finish(board, frames, parents, grassCost, trace) {
    const found = parents[board.goal] !== -1;
    const path = [];
    let cost = null;

    if (found) {
      cost = 0;
      for (let current = board.goal; current !== board.start; current = parents[current]) {
        path.push(coordinates(current, board.width));
        cost += enterCost(board.tiles[current], grassCost);
      }
      path.push(coordinates(board.start, board.width));
      path.reverse();
    }
    const result = { frames, path, steps: found ? path.length - 1 : null, cost };
    if (trace) result.trace = trace;
    return result;
  }

  function enterCost(tile, grassCost) {
    return tile === 'g' ? grassCost : 1;
  }

  function traceEvent(trace, type, index, value, pending, width) {
    const entry = ({ index, value }) => ({ cell: coordinates(index, width), value });
    const cell = index === null ? null : coordinates(index, width);
    trace.push({ type, cell, value, pending: pending.map(entry) });
  }

  function searchBfs(board, grassCost, trace) {
    const parents = Array(board.tiles.length).fill(-1);
    const layer = Array(board.tiles.length).fill(-1);
    const queue = [board.start];
    const frames = [];
    layer[board.start] = 0;
    let head = 0;
    function record(type, index) {
      if (!trace) return;
      const pending = queue.slice(head).map((index) => ({ index, value: layer[index] }));
      traceEvent(trace, type, index, index === null ? null : layer[index], pending, board.width);
    }
    record('start', board.start);

    // A head index keeps dequeue constant-time. Mark cells when appending once.
    while (head < queue.length) {
      const current = queue[head++];
      const distance = layer[current];
      if (layer[board.goal] >= 0 && distance > layer[board.goal]) break;

      addToFrame(frames, distance, current, board.width);
      record('take', current);
      // Display the whole layer that first reached T.
      if (distance === layer[board.goal]) continue;

      for (const next of neighbors(current, board)) {
        if (layer[next] >= 0) {
          record('skip', next);
          continue;
        }
        layer[next] = distance + 1;
        parents[next] = current;
        queue.push(next);
        record('add', next);
      }
    }

    record('end', parents[board.goal] === -1 ? null : board.goal);
    return finish(board, frames, parents, grassCost, trace);
  }

  class MinHeap {
    constructor() {
      this.items = [];
    }

    comesFirst(a, b) {
      // Row-major indices break ties just like Python's (cost, row, col).
      return a.cost < b.cost || (a.cost === b.cost && a.index < b.index);
    }

    push(entry) {
      let index = this.items.length;
      this.items.push(entry);
      while (index > 0) {
        const parent = Math.floor((index - 1) / 2);
        if (!this.comesFirst(entry, this.items[parent])) break;
        this.items[index] = this.items[parent];
        index = parent;
      }
      this.items[index] = entry;
    }

    pop() {
      const first = this.items[0];
      const last = this.items.pop();
      if (this.items.length === 0) return first;

      let index = 0;
      while (index * 2 + 1 < this.items.length) {
        let child = index * 2 + 1;
        const right = child + 1;
        if (right < this.items.length && this.comesFirst(this.items[right], this.items[child])) child = right;
        if (!this.comesFirst(this.items[child], last)) break;
        this.items[index] = this.items[child];
        index = child;
      }
      this.items[index] = last;
      return first;
    }
  }

  function searchDijkstra(board, grassCost, trace) {
    const parents = Array(board.tiles.length).fill(-1);
    const distances = Array(board.tiles.length).fill(Infinity);
    const heap = new MinHeap();
    const frames = [];
    distances[board.start] = 0;
    heap.push({ index: board.start, cost: 0 });
    function record(type, index) {
      if (!trace) return;
      const pending = heap.items.map((item) => ({ index: item.index, value: item.cost }));
      traceEvent(trace, type, index, index === null ? null : distances[index], pending, board.width);
    }
    record('start', board.start);

    while (heap.items.length > 0) {
      const { index, cost } = heap.pop();
      if (cost !== distances[index]) continue;

      // Only a cell removed at its minimum cost is included in the playback.
      addToFrame(frames, cost, index, board.width);
      record('take', index);
      if (index === board.goal) break;

      for (const next of neighbors(index, board)) {
        const candidate = cost + enterCost(board.tiles[next], grassCost);
        if (candidate >= distances[next]) continue;

        distances[next] = candidate;
        parents[next] = index;
        heap.push({ index: next, cost: candidate });
        record('add', next);
      }
    }

    record('end', parents[board.goal] === -1 ? null : board.goal);
    return finish(board, frames, parents, grassCost, trace);
  }

  function solve(grid, algorithm = 'bfs', { grassCost = 3, trace = false } = {}) {
    const board = readGrid(grid);
    if (!Number.isInteger(grassCost) || grassCost < 1 || grassCost > 5) {
      throw new Error('草坪代价必须是 1 至 5 的整数。');
    }
    const events = trace ? [] : null;
    if (algorithm === 'bfs') return searchBfs(board, grassCost, events);
    if (algorithm === 'dijkstra') return searchDijkstra(board, grassCost, events);
    throw new Error('未知的寻路算法。');
  }

  const engine = { solve };
  if (typeof module === 'object' && module.exports) module.exports = engine;
  else root.CourseworkEngine = engine;
})(globalThis);
