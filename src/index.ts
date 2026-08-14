/**
 * 文学创作模式插件：为 DeepSeek Harness 提供无行号的整文件读取工具。
 *
 * `read_plain` 与 `str_replace_editor` 的 `view`（带行号）互补：它返回文件
 * 的原始全文，不含行号、不含截断指引、不含任何编码味注释，让模型以"读一篇
 * 文稿"而非"查第几行"的方式阅读文学作品。
 *
 * 刻意不注册任何 systemPrompt 片段：文学预设的人设是 `complete: true` 的
 * 完整系统提示，任何额外的提示文本都会稀释创作空间。
 * @module @whiting/dsh-literature
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-fs'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolRunContext } from '@deepseek-ai/dsh-tools'

/** Cordis 插件名，loader 诊断用。 */
export const name = 'dsh-literature'

/** 本插件需要注入的服务。 */
export const inject = ['tools', 'fs']

/** 插件配置：无行号读取的大小上限。 */
export interface Config {
  /**
   * 一次 `read_plain` 允许读取的最大字节数。超过上限报错，防止误读大文件
   * 撑爆上下文。默认 512 KiB（UTF-8 中文约 17 万字）。
   */
  maxBytes?: number
}

/** 运行时配置 schema（schemastery 应用默认值）。 */
export const Config: z<Config> = z.object({
  maxBytes: z.number().default(512 * 1024),
})

/** 默认读取上限，与 Config 的默认值保持一致。 */
const DEFAULT_MAX_BYTES = 512 * 1024

/** 校验并解析读取参数。 */
function parsePath(path: string): string {
  if (typeof path !== 'string' || path.trim().length === 0) {
    throw new Error('path must be a non-empty string')
  }
  return path
}

/** 注册 `read_plain` 工具。 */
function registerReadPlain(ctx: Context, maxBytes: number): void {
  ctx.tools.register(defineTool({
    name: 'read_plain',
    description: '读取文本文件的全部内容，不添加行号。适合完整阅读文稿、章节、笔记等文学作品文件。',
    parameters: {
      path: {
        type: 'string',
        required: true,
        description: '要读取的文件路径。使用绝对路径。',
      },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args, exec) {
      const path = parsePath(args.path)
      const target = await ctx.fs.resolve(path, { signal: exec.signal })
      const info = await ctx.fs.stat(target, exec.signal)
      if (info === undefined) {
        throw new Error(`file not found: ${path}`)
      }
      if (info.type !== 'file') {
        throw new Error(`not a regular file: ${path}`)
      }
      if (info.size !== undefined && info.size > maxBytes) {
        throw new Error(
          `file is ${info.size} bytes, exceeding the read limit of ${maxBytes} bytes; `
          + `use str_replace_editor view with a view_range to read it in parts`,
        )
      }
      const text = await ctx.fs.readText(target, exec.signal)
      // 记录观察，与 str_replace_editor 的 view 一致，供观察策略跟踪版本。
      ctx.emit('fs/observed', target, { kind: 'present', version: info.version }, exec)
      return text
    },
    isConcurrencySafe: () => true,
    presentCall(args) {
      return {
        card: 'generic',
        title: `read ${args.path}`,
        kind: 'read',
        locations: [{ path: args.path }],
      }
    },
  }))
}

/** 应用本插件：注册工具（注册随 fiber 自动解除）。 */
export function apply(ctx: Context, config: Config): void {
  const maxBytes = config.maxBytes ?? DEFAULT_MAX_BYTES
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new Error(`dsh-literature: maxBytes must be a positive safe integer`)
  }
  registerReadPlain(ctx, maxBytes)
}
