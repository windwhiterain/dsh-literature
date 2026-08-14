import z from "@deepseek-ai/schemastery";
import { Context } from "@deepseek-ai/cordis";
//#region src/index.d.ts
/** Cordis 插件名，loader 诊断用。 */
declare const name = "dsh-literature";
/** 本插件需要注入的服务。 */
declare const inject: string[];
/** 插件配置：无行号读取的大小上限。 */
interface Config {
  /**
   * 一次 `read_plain` 允许读取的最大字节数。超过上限报错，防止误读大文件
   * 撑爆上下文。默认 512 KiB（UTF-8 中文约 17 万字）。
   */
  maxBytes?: number;
}
/** 运行时配置 schema（schemastery 应用默认值）。 */
declare const Config: z<Config>;
/** 应用本插件：注册工具（注册随 fiber 自动解除）。 */
declare function apply(ctx: Context, config: Config): void;
//#endregion
export { Config, apply, inject, name };