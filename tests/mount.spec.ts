/**
 * 文学预设真实挂载测试。
 *
 * 组合一个与 dsh-agent-presets 官方测试同构的运行时（Loader + Include +
 * 各注册表 + roster），然后像会话启动一样 `agentPresets.mount` 整个文学
 * 预设，验证：
 * 1. 预设可挂载（所有行激活、无进程级服务泄漏）
 * 2. 工具集恰好是预期的四个（glob / grep / read_plain / str_replace_editor）
 * 3. 系统提示只有人设一节（complete 人设压掉所有其他片段）
 * 4. read_plain 真实读取文件并返回无行号全文
 */
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import Group from '@deepseek-ai/cordis-plugin-group'
import { CallId } from '@deepseek-ai/dsh-llm'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import AgentRegistry, { assembleContextFor, type Agent } from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import AgentPresets, { type Config as RosterConfig } from '@deepseek-ai/dsh-agent-presets'
import SubprocessLocal from '@deepseek-ai/dsh-subprocess-local'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
/** 仓库根：tests/ 的上一级。 */
const REPO_ROOT = join(HERE, '..')
/** 随包分发的文学预设目录。 */
const PRESET_SOURCE = join(REPO_ROOT, 'preset', 'literature')
/**
 * 裸包名解析基准：仓库根。`@deepseek-ai/*` 由 link 的 devDependencies 提供
 * （node_modules 内），`@whiting/dsh-literature` 通过 Node 自引用解析到
 * 本包自己的 exports（与部署中从 harness base 解析的语义一致）。
 */

/** 组装一个带 roster 的运行时（与部署的 mountRootInclude 同构）。 */
async function harness(roster: RosterConfig): Promise<Context> {
  const ctx = new Context()
  ctx.baseUrl = pathToFileURL(REPO_ROOT).href + '/'
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  ctx.loader.builtins.group = Group
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(SessionStore)
  await ctx.plugin(SystemPrompt, { persona: '' })
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(AgentLoop, { agents: [] })
  await ctx.plugin(SubprocessLocal)
  await ctx.plugin(AgentPresets, roster)
  return ctx
}

/** 创建会话并挂载预设，返回 agent。 */
async function agentOn(ctx: Context, id: string, presetId: string): Promise<Agent> {
  const handle = await ctx.agents.create({
    sessionId: SessionId(id),
    setup: async (agentCtx: Context) => void await ctx.agentPresets.mount(agentCtx, presetId),
  })
  return handle.agent
}

const toolNames = (ctx: Context, agent?: Agent): string[] =>
  ctx.tools.schemas(agent).map(schema => schema.name).sort()

describe('literature preset', () => {
  it('mounts the shipped composition with the expected tool set', async () => {
    const ctx = await harness({
      default: 'literature',
      roots: [{ path: dirname(PRESET_SOURCE), trust: 'user' as const }],
      includeUserRoot: false,
    })
    const agent = await agentOn(ctx, 'lit-session', 'literature')

    expect(toolNames(ctx, agent)).toEqual([
      'glob',
      'grep',
      'read_plain',
      'str_replace_editor',
    ])
  })

  it('assembles a system prompt that is exactly the persona', async () => {
    const ctx = await harness({
      default: 'literature',
      roots: [{ path: dirname(PRESET_SOURCE), trust: 'user' as const }],
      includeUserRoot: false,
    })
    const agent = await agentOn(ctx, 'lit-prompt', 'literature')

    const prompt = await ctx.systemPrompt.assemble(assembleContextFor(agent))
    // complete 人设：唯一一节，且不含任何工具引导/运行时上下文文本。
    expect(prompt.sections).toHaveLength(1)
    const [section] = prompt.sections
    expect(section.text).toContain('文学创作者')
    expect(section.text).not.toContain('Use the read tool')
    expect(prompt.tools.map(schema => schema.name)).toEqual([
      'glob',
      'grep',
      'read_plain',
      'str_replace_editor',
    ])
  })

  it('read_plain returns the raw file content without line numbers', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsh-literature-read-'))
    const file = join(dir, 'chapter.md')
    const content = '第一行。\n第二行。\n第三行。\n'
    await writeFile(file, content, 'utf8')

    const ctx = await harness({
      default: 'literature',
      roots: [{ path: dirname(PRESET_SOURCE), trust: 'user' as const }],
      includeUserRoot: false,
    })
    const agent = await agentOn(ctx, 'lit-read', 'literature')
    const definition = ctx.tools.get('read_plain', agent)

    expect(definition).toBeDefined()
    const result = await ctx.tools.execute({
      callId: CallId('lit-read-call'),
      name: 'read_plain',
      arguments: { path: file },
      agent,
      signal: new AbortController().signal,
    })
    expect(result.content).toEqual([{ type: 'text', text: content }])
    // 无行号：原始文本原样返回。
    const block = result.content[0]
    expect(block.type === 'text' && block.text).toBe(content)
  })
})
