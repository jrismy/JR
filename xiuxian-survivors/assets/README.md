# 素材目录

放入 PNG 后启动即自动加载；**任何文件缺失都会自动回退到代码绘制版本**，不会报错。
像素素材渲染时关闭平滑、按整数倍缩放，建议用小尺寸像素图（帧高 20–32px 即可）。

## 玩家（分层合成，见 `src/appearance.js`）

| 文件 | 内容 | 规格 |
|---|---|---|
| `player/base_idle.png` | 身体层 · 待机 | 单行 4 帧 |
| `player/base_run.png` | 身体层 · 奔跑 | 单行 4 帧 |
| `player/robe_idle.png` | 法袍层 · 待机（会按境界做色相偏移） | 单行 4 帧，与 base 同帧宽 |
| `player/robe_run.png` | 法袍层 · 奔跑 | 单行 4 帧 |
| `player/acc_jindan.png` | 饰品 · 金丹期起佩戴 | 单帧 |
| `player/acc_heti.png` | 饰品 · 炼虚期起佩戴 | 单帧 |
| `player/acc_zhenxian.png` | 饰品 · 渡劫期起佩戴 | 单帧 |

- 帧数与帧率在 `src/appearance.js` 的 `SHEET` 中配置（默认 idle 4帧@5fps，run 4帧@10fps）
- 所有帧图底边对齐（角色脚底），朝向默认向右，向左时程序自动镜像
- 光环层（aura）由程序在辉光层绘制，颜色/强度也在 `appearance.js` 按境界配置

## 敌人（可选，单帧）

`enemies/swift.png` / `enemies/normal.png` / `enemies/elite.png` / `enemies/boss.png`

缺失时使用默认的水墨墨团造型。

## 当前占位素材

仓库自带一套程序生成的极简像素占位图，用于跑通管线与对比效果，直接覆盖同名文件即可换成你的美术。设置中可随时切换「经典绘制 / 素材皮肤」对比。
