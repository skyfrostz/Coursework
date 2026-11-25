# Coursework

校园地图最短步数课堂演示。先看最优路线，再逐步查看 BFS 如何搜索，以及 Dijkstra 如何处理草坪和道路的不同代价。[在线演示](https://soulcourse.cn/coursework/)

## 本地运行

在仓库根目录执行：

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

浏览器打开 [http://127.0.0.1:8000/coursework/](http://127.0.0.1:8000/coursework/)。

页面提供地图编辑、八步算法讲解和草坪路线对照。切换 Python 或 C++ 可查看对应的示例源码。网页使用 JavaScript 执行搜索。

## 运行测试

```sh
node --test tests/coursework-engine.test.cjs
```

源码从 [SoulCourse](https://github.com/skyfrostz/SoulCourse) 的课堂作业演示中提取。原项目许可证见 [LICENSE](LICENSE)。
