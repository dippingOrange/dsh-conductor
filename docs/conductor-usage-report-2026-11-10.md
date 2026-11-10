# Conductor 历史 Token 使用统计（从 DSH session 日志回算）

- 统计时间：2026-08-25 17:38 — 2026-11-10 17:44
- 扫描日志：257 个；父会话 54 个；子会话 203 个
- 口径：只统计 `assistant/message.usage`；`cacheRead` 是缓存命中输入，和普通 input 分列，不重复相加。
- 注意：这是从日志回算的历史值，不包含已经被删除的 transcript；fork/seed 会话可能带来少量重复。

## 总览

| 角色 | input | output | cacheRead | cacheWrite | calls |
|---|---:|---:|---:|---:|---:|
| Leader（全部父会话） | 57,956,285 | 10,217,763 | 4,286,873,110 | 945,969 | 13,381 |
| Leader（Conductor 相关父会话） | 20,264,495 | 3,172,395 | 1,427,410,560 | 0 | 4,197 |
| Worker（全部子会话） | 86,388,202 | 8,922,104 | 1,102,673,216 | 0 | 10,929 |

## Leader（Conductor 相关父会话）

| provider | model | input | output | cacheRead | cacheWrite | calls |
|---|---|---:|---:|---:|---:|---:|
| command-code | deepseek/deepseek-v4.1-flash | 10,399,287 | 1,971,691 | 848,707,968 | 0 | 2,733 |
| deepseek-official | deepseek-flash | 9,771,459 | 1,199,771 | 578,702,592 | 0 | 1,458 |
| nqiv | DeepSeek-V4.1-Flash | 93,749 | 933 | 0 | 0 | 6 |

## Worker（全部子会话）

| provider | model | input | output | cacheRead | cacheWrite | calls |
|---|---|---:|---:|---:|---:|---:|
| nqiv | DeepSeek-V4.1-Flash | 55,558,942 | 383,001 | 0 | 0 | 665 |
| command-code | deepseek/deepseek-v4.1-flash | 29,020,965 | 7,663,942 | 1,017,709,184 | 0 | 9,529 |
| opencode-go | deepseek-v4.1-flash | 907,864 | 427,864 | 60,014,208 | 0 | 455 |
| command-code | z-ai/glm-5.3-flash | 223,402 | 235,381 | 4,753,472 | 0 | 50 |
| deepseek-official | deepseek-flash | 267,318 | 152,442 | 16,301,824 | 0 | 164 |
| command-code | deepseek/deepseek-v4-flash-fast | 240,378 | 1,618 | 270,848 | 0 | 39 |
| command-code | deepseek/deepseek-v4-pro | 169,333 | 57,856 | 3,623,680 | 0 | 27 |

## 说明

- 订阅制 worker 的 token 量不等于账单；它用于衡量订阅利用率。
- 官方 API 的 leader 成本需要按 input / cacheRead / output 分别套价格。
- 这份报告是**历史回算**；持续统计需要插件增加 usage ledger / UI。
