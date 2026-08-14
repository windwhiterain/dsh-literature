<h1 align="center">dsh-literature</h1>

<p align="center">
  <strong>文学创作模式：人设即全部系统提示，零编码噪音</strong><br/>
  为 DeepSeek Harness 提供极简文学 Agent 预设与无行号整文件读取工具。
</p>

DSH plugin: 极简文学创作模式（固定人设 + 本地文件读写/查找/搜索，无 shell、无计划、无目标等 agentic 噪音）; official bundle-free plugin, install via `dsh plugin --profile web add`

## 特性

- **人设即全部系统提示**（`complete: true`）：系统提示只有一句文学人设；全局身份、Web 导向、工具引导等片段全部被抑制，运行时上下文快照也关闭——为创作留出最大空间
- **无行号整文件读取** `read_plain`：与 `str_replace_editor` 的 `view`（带行号）互补，原样返回文件全文，无行号、无截断指引、无编码味注释
- **最小工具集**：`read_plain`、`str_replace_editor`（读写/编辑）、`glob`（按名查找）、`grep`（按内容搜索）——只有本地文件读写
- **本地自由读写**：工具跑在裸本地文件系统（`dsh-fs-local`）上，不受沙箱约束

## 安装

前提：已安装 DeepSeek Harness（Node ≥ 22.19），并已初始化 web profile。

```bash
# 1. 把插件装进 web profile 依赖树（包名才能被 preset 组合解析）
dsh plugin --profile web add github:whiting/dsh-literature#main

# 2. 把「文学」预设安装到用户预设目录（~/.dsh/.agent-presets/）
npx dsh-literature install
```

安装后，在 Web GUI 新建会话时选择「文学」模式即可。

> 第 2 步是必需的：Harness 的预设发现机制只扫描 `~/.dsh/.agent-presets/`，不会从 npm 包自动发现预设。install 脚本把包内的 `agent.cordis.yml`、`preset.yml` **复制**到用户预设根——副本可自由编辑（官方语义视 preset 为"用户输入"）；包升级后重跑该命令即可跟随。

## 工具

| 工具 | 说明 |
|---|---|
| `read_plain` | 读取文本文件全部内容，**不带行号**；上限可配置（默认 512 KiB） |
| `str_replace_editor` | 查看 / 创建 / 替换 / 插入文本文件（带行号、绝对路径） |
| `glob` | 按文件名模式查找文件 |
| `grep` | 按内容搜索文本 |

## 开发

```bash
pnpm install    # devDependencies 以 link: 指向 ../deepseek-harness（与部署同版本）
pnpm build      # tsdown 构建 lib/
pnpm test       # vitest：真实挂载文学预设 + 工具行为验证
pnpm typecheck
```

开发循环（一边开发一边使用）：

```bash
dsh plugin --profile web add <dsh-literature目录>   # 首次：本地目录方式装进 profile
pnpm build                                          # 改完 src/ 后构建
# 重启 harness web 使新工具生效（ESM 模块缓存）
```

- 改 `preset/*.yml`：重跑 `node scripts/install.mjs`，新会话生效
- 改 `src/*.ts`：构建后需重启 web 进程

> 依赖说明：本插件**不声明** `@deepseek-ai/*` 依赖——官方包由 profile 的 pnpm 闭包挂载时注入（`$DSH_HOME/profiles/node_modules` flat fallback），声明了公共 npm 解析不到反而失败。devDependencies 的 `link:` 仅用于本地开发与测试。

### 测试说明

`tests/mount.spec.ts` 组合了一个与部署同构的运行时（Loader + Include + Group + 各注册表 + roster），真实挂载随包分发的文学预设，验证：

1. 预设可挂载，工具集恰好是 `glob / grep / read_plain / str_replace_editor`
2. 系统提示只有人设一节（complete 人设压掉所有其他片段）
3. `read_plain` 真实读取文件并返回无行号全文

## 发布

```bash
npm login        # 注册 npm 账号后
pnpm build
npm publish      # access: public（publishConfig 已设置）
```

## 目录结构

```
src/index.ts                 # read_plain 工具（TS + defineTool + schemastery）
preset/literature/           # 文学 agent 定义（组合 + 元数据）
scripts/install.mjs          # 安装脚本（bin: dsh-literature）
tests/mount.spec.ts          # 真实挂载验证
```

## License

MIT
