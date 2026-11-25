(function () {
  'use strict';

  const maps = {
    detour: ['#.....#', 'S..#...', '.#.#.#T', '...#...', '.......'],
    grass: ['SgggT', '.###.', '.....'],
    official: ['S.#....', '.##.##.', '.#..#..', '.##...#', '....#.T'],
    adjacent: ['ST'],
    blocked: ['#S##', '####', '....', '...T'],
  };
  const tiles = {
    '.': ['road', '道路'],
    '#': ['wall', '墙'],
    S: ['start', '起点'],
    T: ['goal', '终点'],
    g: ['grass', '草坪'],
  };
  const navigation = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
  const solve = CourseworkEngine.solve;
  const grassEntryCost = 3;
  const get = (id) => document.getElementById(id);
  const lab = get('lab');
  const board = get('board');
  const metricValue = get('metric-value');
  const metricReveal = get('metric-reveal');
  const edit = get('edit');
  const fullscreen = get('fullscreen');
  const previous = get('previous');
  const next = get('next');
  const play = get('play');
  const reset = get('reset');
  const presetButtons = [...document.querySelectorAll('button[data-preset]')];
  const toolButtons = [...document.querySelectorAll('button[data-tool]')];
  const background = document.querySelectorAll('.masthead, .introduction, .lessons, .comparison, .footer, .skip-link');
  const languageSwitch = get('language-switch');
  const mastheadNav = languageSwitch.nextElementSibling;
  const sourceDrawer = get('source-drawer');
  const sourceTrigger = get('open-source');
  const sourceFiles = [...sourceDrawer.querySelectorAll('[data-algorithm]')];
  const sourceScroll = get('source-scroll');
  const sourceCode = get('source-code');
  const sourceFollow = get('source-follow');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const grassPrice = get('grass-price');
  const comparePlay = get('compare-play');
  const compareNext = get('compare-next');
  const priceChoices = [...document.querySelectorAll('[data-price]')];
  const pythonRanges = {
    bfs: {
      start: [[[32, 34]], '把起点标为已访问，放进队列。'],
      expand: [[[36, 37], [41, 46], [49, 50]], '从队首取出这一层的位置，把没访问过的邻格放到队尾。'],
      found: [[[37, 39]], '从队首取到终点，返回到这里的步数。'],
      end: [[[52, 52]], '队列空了仍未找到终点，返回 None。'],
    },
    dijkstra: {
      start: [[[34, 36]], '起点花费是 0，把它放进最小堆。'],
      expand: [[[38, 41], [45, 56]], '先取出总代价最小的位置。走到邻格更省时，更新代价并入堆。'],
      found: [[[39, 43]], '终点以最低代价出堆，返回它的总代价。'],
      end: [[[58, 58]], '最小堆空了仍未找到终点，返回 None。'],
    },
  };
  const cppRanges = {
    bfs: {
      start: [[[22, 24]], '用 q.push() 把起点放进队列，并用 vis 标记。'],
      expand: [[[25, 27], [31, 39]], '用 q.front() 读队首，再用 q.pop() 移除。没访问过的邻格用 q.push() 加入队尾。'],
      found: [[[26, 29]], '从队首取到终点，返回 cur.step。'],
      end: [[[42, 42]], '队列空了仍未找到终点，返回 −1。'],
    },
    dijkstra: {
      start: [[[32, 34]], '起点花费是 0，用 pq.push() 放进优先队列。'],
      expand: [[[36, 39], [42, 52]], '用 pq.top() 读堆顶，再用 pq.pop() 移除。找到更低代价就更新 dist 并入堆。'],
      found: [[[37, 40]], '终点以最低代价出堆，返回 cur.cost。'],
      end: [[[55, 55]], '最小堆空了仍未找到终点，返回 −1。'],
    },
  };
  const pythonTokens = /#.*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:and|as|def|else|except|False|for|from|if|import|in|is|None|not|or|raise|return|True|try|while|continue)\b|\b\d+\b/g;
  const cppTokens = /\/\/.*|#include\b|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:auto|bool|char|const|continue|else|false|for|if|int|return|static_cast|struct|true|using|while)\b|\b\d+\b/g;
  const languages = {
    python: {
      title: 'Python', extension: 'py', tokens: pythonTokens, ranges: pythonRanges, firstIndex: 0,
      operations: {
        bfs: { start: 'queue = deque(...)', add: 'queue.append()', take: 'queue.popleft()' },
        dijkstra: { start: 'heap = [(0, start_row, start_col)]', add: 'heapq.heappush()', take: 'heapq.heappop()' },
      },
    },
    cpp: {
      title: 'C++', extension: 'cpp', tokens: cppTokens, ranges: cppRanges, firstIndex: 1,
      operations: {
        bfs: { start: 'q.push({sx, sy, 0});', add: 'q.push({nx, ny, cur.step + 1});', take: 'q.front(); q.pop();', skip: 'vis[nx][ny]' },
        dijkstra: { start: 'pq.push({sx, sy, 0});', add: 'pq.push({nx, ny, new_cost});', take: 'pq.top(); pq.pop();' },
      },
    },
  };

  let scenario = 'detour';
  let language = languageSwitch.querySelector('input:checked').value;
  let algorithm = 'bfs';
  let customGrid = [...maps.official];
  let grid = maps[scenario];
  let result;
  let finishPreviewReveal = null;
  let cursor = -1;
  let timer = null;
  let editing = false;
  let activeTool = '#';
  let activeCell = 0;
  let fallbackFullscreen = false;
  let sourceOpen = false;
  let sourceAnimation = null;
  let sourceScrollTarget = null;
  let phase = 'preview';
  let comparison;
  let compareStep = null;
  let compareTimer = null;

  function drawBoard(element, map, interactive = false) {
    element.style.setProperty('--columns', map[0].length);
    const cells = map.join('').split('').map((_, index) => {
      const cell = document.createElement(interactive ? 'button' : 'div');
      cell.className = 'cell';
      if (interactive) {
        cell.type = 'button';
        cell.tabIndex = index === activeCell ? 0 : -1;
        cell.dataset.index = index;
      } else {
        cell.setAttribute('aria-hidden', 'true');
      }
      return cell;
    });
    element.replaceChildren(...cells);
    element.setAttribute('role', interactive ? 'group' : 'img');
    if (element === board) element.parentElement.classList.toggle('is-editing', interactive);
    if (interactive) element.setAttribute('aria-describedby', 'editor-help');
    else element.removeAttribute('aria-describedby');
  }

  function paintCells(element, map, options = {}) {
    const { layers = new Map(), current = new Map(), route = new Map(), animate = false } = options;
    const width = map[0].length;
    for (const [index, tile] of [...map.join('')].entries()) {
      const cell = element.children[index];
      const [kind, label] = tiles[tile];
      const distance = layers.get(index);
      const routeIndex = route.get(index);
      const currentIndex = current.get(index);
      cell.className = 'cell ' + kind;
      cell.dataset.tile = tile;
      cell.style.removeProperty('--delay');
      if (distance !== undefined) cell.classList.add('reached');
      // Keep the endpoint tint distinct until T belongs to the final path.
      if (tile === 'S' || tile === 'T') cell.classList.remove('reached');
      if (currentIndex !== undefined) cell.classList.add('current');
      if (routeIndex !== undefined) cell.classList.add('path');
      if (animate && routeIndex !== undefined) {
        cell.classList.add('route-in');
        cell.style.setProperty('--delay', Math.min(360, routeIndex * 30) + 'ms');
      } else if (animate && currentIndex !== undefined) {
        cell.classList.add('wave');
        cell.style.setProperty('--delay', Math.min(70, currentIndex * 14) + 'ms');
      }
      cell.textContent = tile === 'S' || tile === 'T' ? tile : distance ?? (tile === 'g' ? tile : '');
      if (element === board && editing) {
        const row = Math.floor(index / width) + 1;
        const col = index % width + 1;
        cell.setAttribute('aria-label', '第 ' + row + ' 行第 ' + col + ' 列，' + label);
      }
    }
  }

  function lastFrame() {
    // Add one stop after the last reachable layer to show an exhausted queue.
    return result.frames.length - (result.steps === null ? 0 : 1);
  }

  function disable(button, disabled) {
    button.setAttribute('aria-disabled', String(disabled));
  }

  function setText(id, text) {
    const element = get(id);
    if (element.textContent !== text) element.textContent = text;
  }

  function writeSource() {
    const { title, extension, tokens } = languages[language];
    const source = get(language + '-' + algorithm).content.textContent;
    const rows = source.split('\n').map((text, index) => {
      const line = document.createElement('span');
      line.className = 'source-line';
      line.dataset.line = index + 1;
      let last = 0;
      for (const token of text.matchAll(tokens)) {
        const word = token[0];
        line.append(text.slice(last, token.index));
        const span = document.createElement('span');
        span.className = 'syntax-' + (word.startsWith('//') || (language === 'python' && word.startsWith('#')) ? 'comment'
          : /^['"]/.test(word) ? 'string' : /^\d/.test(word) ? 'number' : 'keyword');
        span.textContent = word;
        line.append(span);
        last = token.index + word.length;
      }
      line.append(text.slice(last) || (last === 0 ? ' ' : ''));
      return line;
    });
    cancelSourceScroll();
    sourceCode.replaceChildren(...rows);
    sourceScroll.scrollLeft = 0;
    if (!sourceFollow.checked) sourceScroll.scrollTop = 0;
    setText('source-title', title + ' 源码');
    sourceScroll.setAttribute('aria-label', title + ' 源码，可滚动');
    for (const button of sourceFiles) {
      button.setAttribute('aria-pressed', String(button.dataset.algorithm === algorithm));
      button.textContent = (button.dataset.algorithm === 'bfs' ? 'p15.' : 'p15_grass.') + extension;
    }
  }

  function cancelSourceScroll() {
    if (sourceScrollTarget === null) return;
    sourceScrollTarget = null;
    sourceScroll.scrollTo({ top: sourceScroll.scrollTop, behavior: 'instant' });
  }

  function centerSource() {
    if (!sourceOpen || editing || phase === 'preview' || !sourceFollow.checked) return;
    // A phase can highlight multiple groups. Center its first actionable block.
    const [first, last] = languages[language].ranges[algorithm][phase][0][0];
    const start = sourceCode.children[first - 1].getBoundingClientRect();
    const end = sourceCode.children[last - 1].getBoundingClientRect();
    const viewport = sourceScroll.getBoundingClientRect();
    const blockCenter = (start.top + end.bottom) / 2;
    const target = Math.max(0, Math.min(sourceScroll.scrollHeight - sourceScroll.clientHeight,
      sourceScroll.scrollTop + blockCenter - viewport.top - sourceScroll.clientHeight / 2));
    if (sourceScrollTarget !== null && Math.abs(target - sourceScrollTarget) < 1) return;
    if (Math.abs(target - sourceScroll.scrollTop) < 1) {
      cancelSourceScroll();
      return;
    }
    sourceScrollTarget = target;
    sourceScroll.scrollTo({ top: target, behavior: reduceMotion.matches ? 'instant' : 'smooth' });
  }

  function renderSource(phase) {
    if (!sourceOpen) return;
    const [ranges, detail] = phase === 'preview'
      ? [[], '当前先看结果。点「开始寻路」后，从初始化起点开始跟随代码。']
      : languages[language].ranges[algorithm][phase];
    setText('source-cue', editing ? '先完成地图编辑，再继续逐步讲解。' : detail);
    for (const line of sourceCode.children) {
      const number = Number(line.dataset.line);
      line.classList.toggle('is-active', !editing && ranges.some(([first, last]) => number >= first && number <= last));
    }
    if (editing || phase === 'preview') cancelSourceScroll();
    else centerSource();
  }

  function setSource(open, animate = false) {
    const wasHidden = sourceDrawer.hidden;
    const style = wasHidden ? null : getComputedStyle(sourceDrawer);
    const from = style ? { opacity: style.opacity, transform: style.transform } : null;
    sourceAnimation?.cancel();
    sourceAnimation = null;
    sourceOpen = open;
    sourceTrigger.setAttribute('aria-expanded', String(open));
    setText('open-source', open ? '收起代码' : '查看代码');

    if (open) {
      lab.classList.add('has-source');
      sourceDrawer.hidden = false;
      sourceDrawer.inert = false;
      sourceDrawer.removeAttribute('aria-hidden');
      renderSource(phase);
    } else {
      cancelSourceScroll();
      if (sourceDrawer.contains(document.activeElement)) sourceTrigger.focus({ preventScroll: true });
      sourceDrawer.inert = true;
      sourceDrawer.setAttribute('aria-hidden', 'true');
    }

    function settle() {
      sourceDrawer.hidden = !open;
      lab.classList.toggle('has-source', open);
    }
    if (!animate || reduceMotion.matches) {
      settle();
      return;
    }
    const side = matchMedia('(min-width: 1000px)').matches;
    const hidden = { opacity: 0, transform: side ? 'translateX(28px)' : 'translateY(12px)' };
    const shown = { opacity: 1, transform: 'none' };
    const motion = sourceDrawer.animate([from ?? hidden, open ? shown : hidden], {
      duration: open ? 220 : 155,
      easing: 'cubic-bezier(.23, 1, .32, 1)',
      fill: 'both',
    });
    sourceAnimation = motion;
    motion.finished.then(() => {
      if (sourceAnimation !== motion) return;
      settle();
      motion.cancel();
      sourceAnimation = null;
    }, () => {});
  }

  function renderPlayback(animate = false) {
    finishPreviewReveal?.();
    const width = grid[0].length;
    const layers = new Map();
    const latest = new Map();
    const route = new Map();
    const preview = cursor === -1;
    const frame = result.frames[Math.max(0, Math.min(cursor, result.frames.length - 1))];
    const finished = cursor === lastFrame();
    const success = finished && result.steps !== null;
    const exhausted = finished && !success;
    const weighted = algorithm === 'dijkstra';
    const reachable = result.steps !== null;

    if (!editing && !preview) {
      for (const { value, cells } of result.frames.slice(0, cursor + 1)) {
        for (const [row, col] of cells) layers.set(row * width + col, value);
      }
      if (!exhausted) {
        frame.cells.forEach(([row, col], index) => latest.set(row * width + col, index));
      }
    }
    if (!editing && (preview || success)) {
      result.path.forEach(([row, col], index) => {
        const cell = row * width + col;
        route.set(cell, index);
        if (preview && !weighted) layers.set(cell, index);
      });
    }
    paintCells(board, grid, { layers, current: latest, route, animate: animate && !preview });
    get('grass-legend').hidden = !grid.some((row) => row.includes('g'));
    board.setAttribute('aria-label', editing
      ? '编辑地图，' + grid.length + ' 行 ' + width + ' 列'
      : '地图，' + grid.length + ' 行 ' + width + ' 列，'
        + (preview ? !reachable ? '无法到达终点'
          : weighted ? '最低代价 ' + result.cost + '，' + result.steps + ' 步' : '最短路线 ' + result.steps + ' 步'
          : weighted ? '当前代价 ' + frame.value : '当前第 ' + frame.value + ' 层'));

    get('playback-panel').hidden = editing;
    get('edit-panel').hidden = !editing;
    edit.setAttribute('aria-pressed', String(editing));
    setText('edit', editing ? '结束编辑' : '编辑地图');
    setText('algorithm-name', weighted ? 'Dijkstra' : 'BFS');
    phase = preview ? 'preview' : success ? 'found' : exhausted ? 'end' : cursor === 0 ? 'start' : 'expand';
    renderSource(phase);
    if (editing) return;

    const showResult = preview || finished;
    const unreachable = showResult && !reachable;
    const readout = metricValue.closest('.metric');
    readout.classList.toggle('complete', showResult && reachable);
    readout.classList.toggle('unreachable', unreachable);
    setText('metric-label', preview ? weighted ? '最低代价' : '最少步数'
      : finished ? '搜索结果' : weighted ? '累计代价' : '当前层');
    setText('metric-value', unreachable ? '无法到达'
      : String(preview ? weighted ? result.cost : result.steps : frame.value));
    setText('metric-unit', unreachable || weighted ? '' : showResult ? '步' : '层');
    setText('previous', cursor === 0 ? '返回结果' : weighted ? '上一轮' : '上一层');
    setText('next', preview ? '开始寻路' : weighted ? '下一轮' : '下一层');
    get('playback-controls').classList.toggle('is-preview', preview);
    previous.hidden = play.hidden = reset.hidden = preview;
    if (preview) {
      setText('status-title', reachable ? '先看路线' : '起点与终点不连通');
      setText('status-detail', !reachable ? '开始寻路，看看程序如何确认没有可走的路线。'
        : weighted ? '深青色是最低代价路线，共 ' + result.steps + ' 步。开始寻路，看看它怎样选出来。'
          : '深青色是一条最短路线。开始寻路，看看程序怎样从 S 找到 T。');
    } else if (success) {
      setText('status-title', '找到终点 T');
      setText('status-detail', weighted
        ? '最低代价为 ' + result.cost + '，这条路线一共走了 ' + result.steps + ' 步。'
        : 'T 第一次出现在第 ' + frame.value + ' 层。深青色是一条最短路线。');
    } else if (exhausted) {
      setText('status-title', '搜索结束');
      setText('status-detail', '从起点能走到的格子都检查完了，仍然到不了 T。');
    } else if (cursor === 0) {
      setText('status-title', '从起点出发');
      let detail = weighted ? '起点的代价是 0。进入草坪花费 3，其他可走格花费 1。'
        : '站在 S 上时走了 0 步。点「下一层」看看一步能走到哪里。';
      if (scenario === 'detour' && !weighted) detail = '墙的上下各有一条路。先猜哪边更短，再点「下一层」。';
      if (scenario === 'grass' && weighted) detail = '草坪每格花费 3，道路每格花费 1。猜猜走哪边更省，再点「下一轮」。';
      setText('status-detail', detail);
    } else {
      setText('status-title', '新到达 ' + frame.cells.length + ' 格');
      setText('status-detail', weighted
        ? '这一轮确认了累计代价为 ' + frame.value + ' 的位置。'
        : '从上一层出发，再走一步。描边标出第一次在这一层到达的格子。');
    }
    disable(previous, preview);
    disable(next, finished);
    setText('play', timer !== null ? '暂停' : finished ? '重播' : '播放');
    if (preview && animate && reachable && !reduceMotion.matches) revealPreview(weighted);
  }

  function revealPreview(weighted) {
    const width = grid[0].length;
    const cells = result.path.map(([row, col]) => {
      const cell = board.children[row * width + col];
      const text = cell.textContent;
      const reached = cell.classList.contains('reached');
      cell.classList.remove('path', 'reached');
      if (grid[row][col] === '.') cell.textContent = '';
      return { cell, text, reached, price: weighted && grid[row][col] === 'g' ? grassEntryCost : 1 };
    });
    // Keep a visible rhythm on small maps and cap the total wait on longer routes.
    const interval = Math.max(300, Math.min(result.steps * 60, 720)) / result.steps;
    let shown = -1;
    let total = 0;
    let frameId;
    const started = performance.now();

    function revealThrough(index, animate) {
      while (shown < index) {
        shown += 1;
        const { cell, text, reached, price } = cells[shown];
        cell.textContent = text;
        cell.classList.add('path');
        cell.classList.toggle('reached', reached);
        cell.classList.toggle('preview-in', animate);
        if (shown > 0) total += price;
      }
      metricReveal.textContent = total;
    }

    finishPreviewReveal = () => {
      cancelAnimationFrame(frameId);
      revealThrough(cells.length - 1, false);
      metricReveal.hidden = true;
      finishPreviewReveal = null;
    };

    function tick(now) {
      const index = Math.min(cells.length - 1, Math.floor((now - started) / interval));
      if (index > shown) revealThrough(index, true);
      if (index === cells.length - 1) finishPreviewReveal();
      else frameId = requestAnimationFrame(tick);
    }

    revealThrough(0, true);
    metricReveal.hidden = false;
    frameId = requestAnimationFrame(tick);
  }

  function stopPlayback() {
    clearInterval(timer);
    timer = null;
  }

  function moveTo(index, animate) {
    cursor = Math.max(-1, Math.min(index, lastFrame()));
    if (cursor === lastFrame()) stopPlayback();
    renderPlayback(animate);
  }

  function renderComparison() {
    const comparisonMap = scenario === 'custom' ? customGrid : maps.grass;
    const grassCost = Number(grassPrice.value);
    stopComparison();
    compareStep = null;
    setText('grass-value', String(grassCost));
    grassPrice.setAttribute('aria-valuetext', String(grassCost) + ' 单位代价');
    setText('comparison-title', scenario === 'custom' ? '同一张图，两种走法' : '草坪花费怎样改变路线？');
    setText('comparison-intro', scenario === 'custom'
      ? '进入道路或终点花费 1。调一调草坪代价，观察两种算法选的路线。'
      : '上方要穿过三格草坪，下方全是道路。调一下草坪代价，看哪条更省。');
    for (const button of priceChoices) {
      button.setAttribute('aria-pressed', String(Number(button.dataset.price) === grassCost));
    }
    const routes = ['bfs', 'dijkstra'].map((method) => ({
      method, ...solve(comparisonMap, method, { grassCost }),
    }));
    const [shortest, cheapest] = routes;
    comparison = { map: comparisonMap, grassCost, routes, length: Math.max(shortest.steps, cheapest.steps) };
    const difference = shortest.cost - cheapest.cost;
    const extraSteps = cheapest.steps - shortest.steps;
    setText('comparison-summary', shortest.steps === null ? '这张地图里，两条路线都到不了终点。'
      : difference && extraSteps ? 'Dijkstra 多走 ' + extraSteps + ' 步，少花 ' + difference + '。'
        : difference ? '步数相同，Dijkstra 找到的路线少花 ' + difference + '。'
          : '两条路线的总代价都是 ' + cheapest.cost + '。');
    paintComparison();
  }

  function paintComparison() {
    const { map, routes, grassCost, length } = comparison;
    const width = map[0].length;
    for (const { method, path, steps } of routes) {
      const count = Math.min(steps, compareStep ?? steps);
      const progress = compareStep !== null && count < steps;
      const traveled = path.slice(0, count + 1);
      const route = new Map();
      const layers = new Map();
      let grass = 0;
      for (const [index, [row, col]] of traveled.entries()) {
        const tile = row * width + col;
        if (index > 0 && map[row][col] === 'g') grass += 1;
        route.set(tile, index);
        if (compareStep !== null) layers.set(tile, grass * grassCost + index - grass);
      }
      const road = count - grass;
      const cost = grass * grassCost + road;
      const description = steps === null ? '无法到达' : count + ' 步 / 代价 ' + cost;
      const element = get(method + '-board');
      if (element.dataset.columns !== String(width) || element.childElementCount !== width * map.length) {
        drawBoard(element, map);
        element.dataset.columns = width;
      }
      const current = new Map();
      if (compareStep !== null && traveled.length && compareStep <= steps) {
        const [row, col] = traveled.at(-1);
        current.set(row * width + col, 0);
      }
      paintCells(element, map, { route, layers, current });
      if (current.size) element.children[current.keys().next().value].classList.add('route-focus');
      element.setAttribute('aria-label', (method === 'bfs' ? 'BFS' : 'Dijkstra') + ' 路线图，' + description);
      setText(method + '-result', description);
      setText(method + '-math', steps === null ? ''
        : count === 0 ? '站在起点，累计代价 0。'
          : (grass ? grass + ' × ' + grassCost + '（草坪）＋ ' : '')
            + road + ' × 1（道路与终点）＝ ' + cost
            + (progress ? '，继续前进。' : '，到达终点。'));
    }
    disable(comparePlay, length === 0);
    disable(compareNext, length === 0);
    setText('compare-play', compareTimer !== null ? '暂停'
      : compareStep !== null && compareStep < length ? '继续播放' : '并排走一遍');
  }

  function stopComparison() {
    clearInterval(compareTimer);
    compareTimer = null;
  }

  function walkComparison() {
    if (!comparison.length) return;
    compareStep = compareStep === null || compareStep === comparison.length ? 1 : compareStep + 1;
    if (compareStep === comparison.length) stopComparison();
    paintComparison();
  }

  function selectMap(key, openEditor = false) {
    stopPlayback();
    scenario = key;
    const method = key === 'custom' ? algorithm : key === 'grass' ? 'dijkstra' : 'bfs';
    if (method !== algorithm) {
      algorithm = method;
      writeSource();
    }
    editing = openEditor;
    grid = key === 'custom' ? customGrid : maps[key];
    result = solve(grid, algorithm, { grassCost: grassEntryCost });
    cursor = -1;
    activeCell = 0;
    for (const button of presetButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.preset === key));
    }
    drawBoard(board, grid, editing);
    renderPlayback(!editing);
    renderComparison();
    if (editing) {
      setText('edit-status', '使用 5 行 7 列地图，起点和终点均可移动。');
      board.children[activeCell].focus({ preventScroll: true });
    }
  }

  function paintTile(index) {
    const width = grid[0].length;
    const flat = [...grid.join('')];
    const old = flat[index];
    if (old === activeTool) return;
    if (old === 'S' || old === 'T') {
      setText('edit-status', '这里是' + tiles[old][1] + '。选择对应工具可将它移到其他格子。');
      return;
    }
    if (activeTool === 'S' || activeTool === 'T') {
      flat[flat.indexOf(activeTool)] = '.';
    }
    flat[index] = activeTool;
    customGrid = grid.map((_, row) => flat.slice(row * width, (row + 1) * width).join(''));
    grid = customGrid;
    result = solve(grid, algorithm, { grassCost: grassEntryCost });
    renderPlayback();
    renderComparison();
    const row = Math.floor(index / width) + 1;
    const col = index % width + 1;
    setText('edit-status', '第 ' + row + ' 行第 ' + col + ' 列已改为' + tiles[activeTool][1] + '。');
  }

  function finishEditing() {
    selectMap('custom');
    next.focus({ preventScroll: true });
  }

  function selectAlgorithm(method) {
    if (method === algorithm) return;
    stopPlayback();
    algorithm = method;
    result = solve(grid, algorithm, { grassCost: grassEntryCost });
    writeSource();
    moveTo(-1, true);
  }

  function lessonPosition(cell) {
    const { firstIndex } = languages[language];
    return '(' + cell.map((coordinate) => coordinate + firstIndex).join(', ') + ')';
  }

  function lessonDescription(event, weighted) {
    const position = event.cell ? lessonPosition(event.cell) : '';
    if (event.type === 'start') return '起点在 ' + position + '，先把它放进待处理列表。坐标从 '
      + languages[language].firstIndex + ' 开始。';
    if (event.type === 'add') return '把 ' + position + ' 放进'
      + (weighted ? '最小堆，累计代价为 ' : '队尾，步数为 ') + event.value + '。';
    if (event.type === 'take' && !weighted && event.cell && event.value === 0) return '取出起点 ' + position + '，检查它上下左右的邻格。';
    if (event.type === 'take') return weighted
      ? '取出代价最小的 ' + position + '，它的累计代价为 ' + event.value + '。'
      : '取出排在队首的 ' + position + '，从它继续找相邻格子。';
    if (event.type === 'skip') return position + ' 已经入过队，跳过这个格子。';
    return event.cell
      ? '取出了终点，返回' + (weighted ? '最低代价 ' : '最少步数 ') + event.value + '。'
      : (weighted ? '最小堆' : '队列') + '已空，所有从 S 能到的位置都处理过了，仍然无法到达 T。';
  }

  function animateLessonMove(element, origin, duration) {
    if (!origin || reduceMotion.matches) return;
    const destination = element.getBoundingClientRect();
    const x = (origin.left + origin.right - destination.left - destination.right) / 2;
    const y = (origin.top + origin.bottom - destination.top - destination.bottom) / 2;
    if (Math.abs(x) + Math.abs(y) < 3) return;
    element.animate([{ transform: 'translate(' + x + 'px, ' + y + 'px) scale(.95)', opacity: .63 },
      { transform: 'none', opacity: 1 }], { duration, easing: 'cubic-bezier(.23, 1, .32, 1)' });
  }

  function wireLessonPlayback(lesson, length, draw, pauseAt = -1) {
    const back = lesson.querySelector('[data-lesson-prev]');
    const forward = lesson.querySelector('[data-lesson-next]');
    const restart = lesson.querySelector('[data-lesson-reset]');
    const playback = lesson.querySelector('[data-lesson-play]');
    const progress = lesson.querySelector('[data-lesson-progress]');
    let step = 0;
    let lessonTimer = null;

    function stop() {
      clearInterval(lessonTimer);
      lessonTimer = null;
      playback.textContent = step === length - 1 ? '重播' : '播放';
    }

    function refresh(animate = false) {
      const finished = step === length - 1;
      progress.textContent = '第 ' + (step + 1) + ' 个画面 / ' + length;
      playback.textContent = lessonTimer !== null ? '暂停' : finished ? '重播' : '播放';
      disable(back, step === 0);
      disable(forward, finished);
      disable(restart, step === 0 && lessonTimer === null);
      draw(step, animate);
    }

    function advance() {
      if (step === length - 1) return;
      step += 1;
      if (step === length - 1 || step === pauseAt) stop();
      refresh(true);
    }

    back.addEventListener('click', () => {
      if (step === 0) return;
      stop();
      step -= 1;
      refresh();
    });
    forward.addEventListener('click', () => {
      stop();
      advance();
    });
    restart.addEventListener('click', () => {
      stop();
      step = 0;
      refresh();
    });
    playback.addEventListener('click', () => {
      if (lessonTimer !== null) stop();
      else {
        if (step === length - 1) step = 0;
        lessonTimer = setInterval(advance, 1250);
      }
      refresh();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && lessonTimer !== null) {
        stop();
        refresh();
      }
    });
    refresh();
    return { refresh, stop };
  }

  function renderLessonEntries(entries, cards) {
    const items = cards.map(({ key, label, hint, emphasized }) => {
      const item = document.createElement('li');
      if (key) item.dataset.cell = key;
      if (emphasized) item.classList.add('is-front');
      const title = document.createElement('strong');
      title.textContent = label;
      const subtitle = document.createElement('span');
      subtitle.className = 'lesson-position';
      subtitle.textContent = hint;
      item.append(title, subtitle);
      return item;
    });
    entries.dataset.count = items.length;
    if (items.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'lesson-empty';
      empty.textContent = '空';
      items.push(empty);
    }
    entries.replaceChildren(...items);
    return items;
  }

  function renderLessonEvent(note, label, detail, codeText = '', type = '') {
    const action = document.createElement('span');
    action.className = 'lesson-operation';
    action.textContent = label;
    note.dataset.event = type;
    note.replaceChildren(action);
    if (codeText) {
      const code = document.createElement('code');
      code.textContent = codeText;
      note.append(code, ' ');
    }
    note.append(detail);
    return action;
  }

  function lessonHighlights(cells, width) {
    return new Map(cells.map(([row, col], index) => [row * width + col, index]));
  }

  function lessonLayers(frames, width) {
    const layers = new Map();
    for (const { value, cells } of frames) {
      for (const [row, col] of cells) layers.set(row * width + col, value);
    }
    return layers;
  }

  function startExampleLesson(id, map, length, viewFor) {
    const lesson = get(id);
    const diagram = lesson.querySelector('[data-lesson-board]');
    const entries = lesson.querySelector('[data-lesson-entries]');
    const note = lesson.querySelector('[data-lesson-event]');
    drawBoard(diagram, map);
    return wireLessonPlayback(lesson, length, (step, animate) => {
      const view = viewFor(step);
      paintCells(diagram, view.map ?? map, {
        layers: view.layers,
        current: view.current,
        route: view.route,
        animate,
      });
      diagram.setAttribute('aria-label', view.label + '，' + view.detail);
      renderLessonEntries(entries, view.cards);
      renderLessonEvent(note, view.label, view.detail, view.code);
    }).refresh;
  }

  function setupMapLesson(map) {
    const sequence = [
      { map: ['...', '...'], changed: [], label: '建立网格', detail: '先建一张 2 行 3 列的地图。点「下一步」放入起点 S。' },
      { map: ['S..', '...'], changed: [[0, 0]], label: '放入起点', detail: 'S 是搜索的出发位置。' },
      { map: ['S..', '..T'], changed: [[1, 2]], label: '放入终点', detail: 'T 是要找的位置。' },
      { map, changed: [[0, 2]], label: '设置墙壁', detail: '# 表示不能通过的墙，. 表示道路。地图就绪，可以初始化起点。' },
    ];
    return startExampleLesson('map-lesson', map, sequence.length, (step) => {
      const view = sequence[step];
      return {
        ...view,
        current: lessonHighlights(view.changed, map[0].length),
        cards: view.map.map((row, index) => ({ label: row, hint: '第 ' + (index + 1) + ' 行' })),
      };
    });
  }

  function setupInitialLesson(map, search) {
    const start = search.path[0];
    const width = map[0].length;
    return startExampleLesson('init-lesson', map, 2, (step) => step === 0
      ? { label: '定位起点', detail: '找到 S ' + lessonPosition(start) + '，队列还没有待处理位置。', cards: [] }
      : {
        label: '加入起点',
        detail: 'S 记作已发现并以 0 步入队。接下来就从队首取出 S。',
        code: languages[language].operations.bfs.start,
        current: lessonHighlights([start], width),
        cards: [{ label: '步数 0', hint: lessonPosition(start), emphasized: true }],
      });
  }

  function setupLayerLesson(map, search) {
    const width = map[0].length;
    const goal = search.path.at(-1).join(',');
    return startExampleLesson('layer-lesson', map, search.frames.length, (step) => {
      const { value, cells } = search.frames[step];
      const resultReached = value === search.steps;
      return {
        label: '第 ' + value + ' 层',
        detail: resultReached ? '这一层第一次到达 T，最少要走 ' + value + ' 步。接下来用前驱记录找回整条路线。'
          : value === 0 ? '起点本身是第 0 层，从这里向外扩展。'
            : '有 ' + cells.length + ' 个格子第一次到达。它们离起点都要走 ' + value + ' 步。',
        layers: lessonLayers(search.frames.slice(0, step + 1), width),
        current: lessonHighlights(cells, width),
        cards: cells.map((cell) => ({
          label: cell.join(',') === goal ? '终点 T' : '步数 ' + value,
          hint: lessonPosition(cell),
        })),
      };
    });
  }

  function setupCostLesson(map) {
    const search = solve(map, 'dijkstra');
    const width = map[0].length;
    const goal = search.path.at(-1);
    const grass = search.path.slice(1).filter(([row, col]) => map[row][col] === 'g').length;
    const road = search.steps - grass;
    return startExampleLesson('cost-lesson', map, 3, (step) => {
      const confirmed = step >= 1;
      const completed = step === 2;
      return {
        label: ['等待取出', '确认终点', '输出结果'][step],
        detail: completed
          ? '经过 ' + road + ' 格道路或终点和 ' + grass + ' 格草坪。总代价是 ' + road + ' × 1 + ' + grass + ' × 3 = ' + search.cost + '。'
          : confirmed ? 'T 以累计代价 ' + search.cost + ' 出堆，程序可以返回这个值。'
            : '等 T 从堆顶取出，再确认到 T 的最低代价。',
        code: step === 1 ? (language === 'cpp' ? 'return cur.cost;' : 'return cost') : '',
        layers: lessonLayers(search.frames.slice(0, search.frames.length - (confirmed ? 0 : 1)), width),
        current: confirmed ? lessonHighlights([goal], width) : undefined,
        route: completed ? lessonHighlights(search.path, width) : undefined,
        cards: completed ? [
          { label: search.cost + ' 单位代价', hint: '算法返回值', emphasized: true },
          { label: search.steps + ' 步', hint: '这条路线走过的步数' },
        ] : [{ label: '终点 T', hint: confirmed ? '已确认最低代价' : '等待出堆', emphasized: confirmed }],
      };
    });
  }

  function startLesson(id, map, method, backtrack = false) {
    const lesson = get(id);
    const weighted = method === 'dijkstra';
    const result = solve(map, method, { trace: !backtrack });
    const reversed = backtrack ? [...result.path].reverse() : [];
    const trace = backtrack
      ? [...reversed.map((cell, index) => ({
        type: 'backtrack', cell, pending: reversed.slice(0, index + 1),
      })), { type: 'reverse', cell: null, pending: result.path }]
      : result.trace;
    const diagram = lesson.querySelector('[data-lesson-board]');
    const entries = lesson.querySelector('[data-lesson-entries]');
    const note = lesson.querySelector('[data-lesson-event]');
    const question = lesson.querySelector('.lesson-question');
    const predictionStep = question ? trace.findIndex((event) => event.type === 'add' && event.value === 1
      && event.pending.length === 2 && event.pending[1].value === 3) : -1;
    const methods = {
      start: '加入起点',
      add: weighted ? '入堆' : '入队',
      take: weighted ? '取出堆顶' : '取出队首',
      skip: '跳过',
      end: '搜索结束',
      backtrack: '沿前驱回退',
      reverse: '反转顺序',
    };
    drawBoard(diagram, map);

    function operation(type) {
      if (backtrack) return '';
      return languages[language].operations[method][type] ?? (type === 'skip' ? 'visited' : 'return');
    }

    function description(step) {
      const event = trace[step];
      if (backtrack) {
        if (event.type === 'reverse') return '把收集到的格子反过来，从 S 排到 T。' + event.pending.length
          + ' 个格子之间走了 ' + result.steps + ' 步。';
        if (step === 0) return '从终点 T ' + lessonPosition(event.cell) + ' 开始，先记下终点。';
        return '从 ' + lessonPosition(trace[step - 1].cell) + ' 退到它的前驱 ' + lessonPosition(event.cell)
          + (step === reversed.length - 1 ? '，已经回到起点 S。' : '。点「下一步」继续往回找。');
      }
      if (event.type === 'add') {
        const parent = trace.slice(0, step).findLast((item) => item.type === 'take');
        const [row, col] = event.cell;
        return lessonDescription(event, weighted) + (weighted
          ? '从 ' + lessonPosition(parent.cell) + ' 走来，' + parent.value + ' + '
            + (map[row][col] === 'g' ? '3（草坪）' : '1（道路或终点）') + ' = ' + event.value + '。'
          : '它是从 ' + lessonPosition(parent.cell) + ' 走来的，' + parent.value + ' + 1 = ' + event.value + '。');
      }
      if (weighted && event.type === 'end' && event.cell) {
        return lessonDescription(event, true) + ' 这张小地图沿道路绕行 ' + result.steps
          + ' 步。到下方草坪对照，调代价看看路线会不会改变。';
      }
      return lessonDescription(event, weighted);
    }

    function show(step, animate) {
      const width = map[0].length;
      const event = trace[step];
      const snapshot = new Map();
      if (animate) {
        for (const item of entries.children) {
          snapshot.set(item.dataset.cell, item.getBoundingClientRect());
        }
      }
      const changedKey = event.cell?.join(',');
      const layers = new Map();
      const highlight = new Map();
      for (const item of trace.slice(0, step + 1)) {
        if (item.type === 'start' || item.type === 'take' || item.type === 'add') {
          const [row, col] = item.cell;
          layers.set(row * width + col, item.value);
        }
      }
      if (event.cell) highlight.set(event.cell[0] * width + event.cell[1], 0);
      const route = new Map();
      if (backtrack) {
        for (const { value, cells } of result.frames) {
          for (const [row, col] of cells) layers.set(row * width + col, value);
        }
        for (const [index, [row, col]] of event.pending.entries()) {
          route.set(row * width + col, index);
        }
      } else if (event.type === 'end' && event.cell) {
        for (const [index, [row, col]] of result.path.entries()) route.set(row * width + col, index);
      }
      paintCells(diagram, map, { layers, current: highlight, route, animate });
      diagram.dataset.event = event.type;
      if (backtrack) setText('path-direction', event.type === 'reverse' ? '从 S 到 T 的路线' : '从 T 往 S 回溯');
      diagram.setAttribute('aria-label', (backtrack ? '路线回溯' : weighted ? '最小堆' : '队列') + '演示地图');

      const pending = backtrack ? event.pending.map((cell) => ({ cell })) : event.pending;
      const items = renderLessonEntries(entries, pending.map(({ cell, value }, index) => {
        const key = cell.join(',');
        return {
          key,
          label: backtrack ? (map[cell[0]][cell[1]] === '.' ? '道路' : map[cell[0]][cell[1]])
            : (weighted ? '代价 ' : '步数 ') + value,
          hint: lessonPosition(cell),
          emphasized: backtrack ? key === changedKey : index === 0,
        };
      }));
      const action = renderLessonEvent(note, methods[event.type], description(step), operation(event.type), event.type);

      if (question) {
        const prediction = step === predictionStep;
        if (!prediction && question.contains(document.activeElement)) {
          lesson.querySelector('[data-lesson-next]').focus({ preventScroll: true });
        }
        question.hidden = !prediction;
        if (!prediction) {
          setText('heap-answer', '');
          for (const answer of question.querySelectorAll('[data-predict]')) {
            answer.setAttribute('aria-pressed', 'false');
          }
        }
      }
      if (animate) {
        for (const item of items) {
          const fromBoard = (event.type === 'add' || backtrack) && item.dataset.cell === changedKey;
          const origin = fromBoard ? diagram.children[event.cell[0] * width + event.cell[1]].getBoundingClientRect()
            : snapshot.get(item.dataset.cell);
          animateLessonMove(item, origin, fromBoard ? 380 : 230);
        }
        if (event.type === 'take') animateLessonMove(action, snapshot.get(changedKey), 310);
      }
    }

    const playback = wireLessonPlayback(lesson, trace.length, show, predictionStep);
    if (question) {
      const answers = [...question.querySelectorAll('[data-predict]')];
      for (const answer of answers) {
        answer.addEventListener('click', () => {
          playback.stop();
          for (const button of answers) button.setAttribute('aria-pressed', String(button === answer));
          setText('heap-answer', answer.dataset.predict === '1'
            ? '对，代价 1 在堆顶。点「下一步」看它出堆。'
            : '看堆顶的数字。代价 1 更小，会先被取出。');
        });
      }
    }
    return playback.refresh;
  }

  for (const button of presetButtons) {
    button.addEventListener('click', () => selectMap(button.dataset.preset));
  }
  sourceTrigger.addEventListener('click', (event) => {
    setSource(!sourceOpen, event.detail > 0);
    if (sourceOpen && matchMedia('(max-width: 665px)').matches) {
      sourceDrawer.scrollIntoView({ block: 'nearest' });
    }
  });
  get('source-close').addEventListener('click', (event) => setSource(false, event.detail > 0));
  sourceFollow.addEventListener('change', () => {
    if (sourceFollow.checked) centerSource();
    else cancelSourceScroll();
  });
  for (const event of ['wheel', 'pointerdown']) {
    sourceScroll.addEventListener(event, cancelSourceScroll, { passive: true });
  }
  sourceScroll.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) {
      cancelSourceScroll();
    }
  });
  new ResizeObserver(centerSource).observe(sourceScroll);
  reduceMotion.addEventListener('change', () => {
    if (reduceMotion.matches) finishPreviewReveal?.();
    cancelSourceScroll();
    centerSource();
  });
  for (const button of sourceFiles) {
    button.addEventListener('click', () => selectAlgorithm(button.dataset.algorithm));
  }
  grassPrice.addEventListener('input', renderComparison);
  for (const button of priceChoices) {
    button.addEventListener('click', () => {
      grassPrice.value = button.dataset.price;
      renderComparison();
    });
  }
  comparePlay.addEventListener('click', () => {
    if (!comparison.length) return;
    if (compareTimer !== null) stopComparison();
    else {
      if (compareStep === null || compareStep === comparison.length) compareStep = 0;
      compareTimer = setInterval(walkComparison, 740);
    }
    paintComparison();
  });
  compareNext.addEventListener('click', () => {
    stopComparison();
    walkComparison();
  });
  edit.addEventListener('click', () => {
    if (editing) finishEditing();
    else selectMap('custom', true);
  });
  get('done-editing').addEventListener('click', finishEditing);
  for (const button of toolButtons) {
    button.addEventListener('click', () => {
      activeTool = button.dataset.tool;
      for (const tool of toolButtons) tool.setAttribute('aria-pressed', String(tool === button));
      setText('edit-status', '当前工具为' + tiles[activeTool][1] + '。');
      board.children[activeCell].focus({ preventScroll: true });
    });
  }
  board.addEventListener('focusin', (event) => {
    if (!editing || event.target.dataset.index === undefined) return;
    board.children[activeCell].tabIndex = -1;
    activeCell = Number(event.target.dataset.index);
    event.target.tabIndex = 0;
  });
  board.addEventListener('click', (event) => {
    const cell = event.target.closest('button[data-index]');
    if (editing && cell) paintTile(Number(cell.dataset.index));
  });
  board.addEventListener('keydown', (event) => {
    const offset = navigation[event.key];
    if (!editing || !offset || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    const width = grid[0].length;
    const row = Math.floor(activeCell / width) + offset[0];
    const col = activeCell % width + offset[1];
    if (row >= 0 && row < grid.length && col >= 0 && col < width) {
      board.children[row * width + col].focus();
    }
  });

  previous.addEventListener('click', () => {
    if (cursor === -1) return;
    stopPlayback();
    moveTo(cursor - 1, false);
    if (cursor === -1) next.focus({ preventScroll: true });
  });
  next.addEventListener('click', (event) => {
    if (cursor === lastFrame()) return;
    stopPlayback();
    moveTo(cursor + 1, event.detail > 0);
  });
  play.addEventListener('click', () => {
    if (timer !== null) {
      stopPlayback();
      renderPlayback();
      return;
    }
    if (cursor === lastFrame()) cursor = 0;
    timer = setInterval(() => moveTo(cursor + 1, true), 720);
    renderPlayback();
  });
  reset.addEventListener('click', () => {
    stopPlayback();
    moveTo(-1, true);
    next.focus({ preventScroll: true });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) finishPreviewReveal?.();
    if (document.hidden && timer !== null) {
      stopPlayback();
      renderPlayback();
    }
    if (document.hidden && compareTimer !== null) {
      stopComparison();
      paintComparison();
    }
  });
  get('open-grass').addEventListener('click', (event) => {
    selectMap('grass');
    setSource(true, event.detail > 0);
    lab.scrollIntoView();
    next.focus({ preventScroll: true });
  });

  function showPresentation(active) {
    lab.classList.toggle('is-presenting', active);
    document.body.classList.toggle('presentation-fallback', active && fallbackFullscreen);
    fullscreen.setAttribute('aria-pressed', String(active));
    setText('fullscreen-label', active ? '退出全屏' : '全屏演示');
    const languageFocus = languageSwitch.contains(document.activeElement) ? document.activeElement : null;
    for (const section of background) section.inert = active;
    if (active) lab.querySelector('.lab-actions').before(languageSwitch);
    else mastheadNav.before(languageSwitch);
    languageFocus?.focus({ preventScroll: true });
  }

  fullscreen.addEventListener('click', async () => {
    if (fallbackFullscreen) {
      fallbackFullscreen = false;
      showPresentation(false);
      return;
    }
    if (document.fullscreenElement === lab) {
      await document.exitFullscreen();
      return;
    }
    if (document.fullscreenEnabled && lab.requestFullscreen) {
      try {
        await lab.requestFullscreen();
        return;
      } catch {
        // Use the same classroom view within this browser window.
      }
    }
    fallbackFullscreen = true;
    showPresentation(true);
  });
  document.addEventListener('fullscreenchange', () => {
    if (!fallbackFullscreen) showPresentation(document.fullscreenElement === lab);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (sourceOpen && lab.contains(document.activeElement)) {
      setSource(false);
    } else if (fallbackFullscreen) {
      fallbackFullscreen = false;
      showPresentation(false);
      fullscreen.focus();
    }
  });

  writeSource();
  const lessonMap = ['S.#', '..T'];
  const lessonSearch = solve(lessonMap, 'bfs');
  const weightedLessonMap = ['SgggT', '.....'];
  const refreshLessonLabels = [
    setupMapLesson(lessonMap),
    setupInitialLesson(lessonMap, lessonSearch),
    startLesson('queue-lesson', lessonMap, 'bfs'),
    setupLayerLesson(lessonMap, lessonSearch),
    startLesson('path-lesson', lessonMap, 'bfs', true),
    startLesson('blocked-lesson', ['S.#', '.#T'], 'bfs'),
    startLesson('heap-lesson', weightedLessonMap, 'dijkstra'),
    setupCostLesson(weightedLessonMap),
  ];
  setText('heap-prediction-code', languages[language].operations.dijkstra.take);
  languageSwitch.addEventListener('change', (event) => {
    language = event.target.value;
    writeSource();
    renderSource(phase);
    for (const refresh of refreshLessonLabels) refresh();
    setText('heap-prediction-code', languages[language].operations.dijkstra.take);
    if (sourceOpen && !reduceMotion.matches) {
      sourceCode.getAnimations().forEach((animation) => animation.cancel());
      sourceCode.animate([{ opacity: .45 }, { opacity: 1 }], { duration: 150, easing: 'ease-out' });
    }
  });
  selectMap(scenario);
}());
