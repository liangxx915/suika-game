# 合成大西瓜（简单版）

一个可离线运行的浏览器小游戏。双击 `index.html` 即可开始，无需安装依赖或启动服务器。

在线试玩：[https://liangxx915.github.io/suika-game/](https://liangxx915.github.io/suika-game/)

手机试玩：让电脑和手机连接同一个 Wi-Fi，在电脑上运行 `node server.js`，然后在手机浏览器输入 `http://电脑的局域网 IP:8765/`。电脑关闭或服务停止后，手机链接就会失效。

## 玩法

轻点或单击棋盘会在该位置投放水果；也可以按住并左右移动，松手后在最终位置投放。两个相同水果碰到时会合成更大的水果并加分。水果在警戒线上堆积一段时间后游戏结束，点击“再玩一次”或“重新开始”可重开。

## 奶蛙图片

11 个合成等级已分别使用 [assets/naiwa](assets/naiwa) 中的 11 张透明背景 PNG。`game.js` 顶部的 `FRUITS` 数组管理等级、尺寸、分数和图片路径。绘制时会把图片限制在原有碰撞圆内；若图片加载失败，会显示原来的卡通水果作为回退。

原照片保存在 [assets/naiwa/sources](assets/naiwa/sources)，图片来源与处理说明见 [素材说明](assets/naiwa/README.md)。本地运行仍可直接双击 `index.html`，用 `node server.js` 在手机上试玩时也会提供这些 PNG。

## 项目文件

- `index.html`：页面结构
- `style.css`：界面样式
- `game.js`：规则、物理碰撞和绘制
