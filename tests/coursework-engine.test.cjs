const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { solve } = require('../coursework/engine.js');

function assertPath(grid, result, steps, cost) {
  assert.equal(result.steps, steps);
  assert.equal(result.cost, cost);
  assert.equal(result.path.length, steps + 1);

  const tiles = result.path.map(([row, col]) => grid[row][col]);
  assert.equal(tiles[0], 'S');
  assert.equal(tiles[steps], 'T');
  assert.equal(tiles.includes('#'), false);
  assert.equal(tiles.slice(1).reduce((sum, tile) => sum + (tile === 'g' ? 3 : 1), 0), cost);

  for (let i = 1; i < result.path.length; i += 1) {
    const [row, col] = result.path[i];
    const [prevRow, prevCol] = result.path[i - 1];
    assert.equal(Math.abs(row - prevRow) + Math.abs(col - prevCol), 1);
  }
}

test('official 5×7 map reaches T at BFS layer 12', () => {
  const grid = ['S.#....', '.##.##.', '.#..#..', '.##...#', '....#.T'];
  const result = solve(grid);
  assertPath(grid, result, 12, 12);
  assert.deepEqual(result.frames[0], { value: 0, cells: [[0, 0]] });
  assert.deepEqual(result.frames.map((frame) => frame.value), Array.from({ length: 13 }, (_, i) => i));
  assert.ok(result.frames[12].cells.some(([row, col]) => row === 4 && col === 6));
});

test('BFS playback keeps all cells at its final layer and follows the direction order', () => {
  const result = solve(['ST', '..']);
  assertPath(['ST', '..'], result, 1, 1);
  assert.deepEqual(result.frames, [
    { value: 0, cells: [[0, 0]] },
    { value: 1, cells: [[0, 1], [1, 0]] },
  ]);
  assert.deepEqual(solve(['S.', '.T']).path, [[0, 0], [0, 1], [1, 1]]);
  assert.deepEqual(solve(['S.', '.T'], 'dijkstra').path, [[0, 0], [0, 1], [1, 1]]);
});

test('sealed start is unreachable and leaves the start-only frame', () => {
  for (const algorithm of ['bfs', 'dijkstra']) {
    assert.deepEqual(solve(['#S##', '####', '....', '...T'], algorithm), {
      frames: [{ value: 0, cells: [[0, 1]] }],
      path: [],
      steps: null,
      cost: null,
    });
  }
});

test('grass makes the shortest-step route more expensive than the least-cost route', () => {
  const grid = ['SgggT', '.....'];
  assertPath(grid, solve(grid), 4, 10);

  const leastCost = solve(grid, 'dijkstra');
  assertPath(grid, leastCost, 6, 6);
  assert.deepEqual(leastCost.frames[0], { value: 0, cells: [[0, 0]] });
  assert.equal(leastCost.frames.at(-1).value, 6);
  for (const frame of leastCost.frames) {
    if (frame.value < 3) {
      assert.ok(frame.cells.every(([row, col]) => grid[row][col] !== 'g'));
    }
  }
});

test('Dijkstra skips costs with no settled cells and charges the terminal entry', () => {
  const grid = ['SgT'];
  const result = solve(grid, 'dijkstra');
  assertPath(grid, result, 2, 4);
  assert.deepEqual(result.frames, [
    { value: 0, cells: [[0, 0]] },
    { value: 3, cells: [[0, 1]] },
    { value: 4, cells: [[0, 2]] },
  ]);
});

test('lesson traces show FIFO, a repeated neighbor, and the cheapest heap entry', () => {
  const grid = ['S.#', '..T'];
  const { trace, ...result } = solve(grid, 'bfs', { trace: true });
  assert.deepEqual(result, solve(grid));
  const takes = trace.filter((event) => event.type === 'take');
  assert.deepEqual(takes.slice(0, 4).map((event) => event.cell), [[0, 0], [0, 1], [1, 0], [1, 1]]);
  assert.ok(trace.some((event) => event.type === 'skip' && event.cell.join(',') === '1,1'));
  assert.equal(trace.filter((event) => event.type === 'add' && event.cell.join(',') === '1,1').length, 1);

  const heap = solve(['SgggT', '.....'], 'dijkstra', { trace: true }).trace;
  assert.deepEqual(heap.slice(2, 5).map((event) => [event.type, event.value]), [
    ['add', 3], ['add', 1], ['take', 1],
  ]);
  for (let index = 1; index < heap.length; index += 1) {
    if (heap[index].type === 'take') {
      assert.equal(heap[index].value, Math.min(...heap[index - 1].pending.map((entry) => entry.value)));
    }
  }
});

test('grass comparison charges the chosen price without affecting the default search', () => {
  const grid = ['SgggT', '.....'];
  for (const [grassCost, steps, cost] of [[1, 4, 4], [2, 6, 6], [5, 6, 6]]) {
    assert.equal(solve(grid, 'bfs', { grassCost }).cost, 3 * grassCost + 1);
    const weighted = solve(grid, 'dijkstra', { grassCost });
    assert.equal(weighted.steps, steps);
    assert.equal(weighted.cost, cost);
  }
  assert.equal(solve(grid).cost, 10);
  assert.throws(() => solve(grid, 'bfs', { grassCost: 0 }), /草坪代价/);
});

test('invalid map and algorithm inputs are rejected', () => {
  for (const grid of [[], ['ST', '.'], ['SX'], ['SS.T'], ['...']]) {
    assert.throws(() => solve(grid), /地图/);
  }
  assert.throws(() => solve(['ST'], 'unknown'), /算法/);
});

test('classic script exposes the offline browser engine', () => {
  const script = readFileSync(path.join(__dirname, '../coursework/engine.js'), 'utf8');
  const browser = vm.createContext({});
  vm.runInContext(script, browser);
  assert.equal(browser.CourseworkEngine.solve(['ST']).steps, 1);
});
