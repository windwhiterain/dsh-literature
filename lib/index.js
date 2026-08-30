import z from "@deepseek-ai/schemastery";
import { defineTool } from "@deepseek-ai/dsh-tools";
//#region src/index.ts
/** Cordis 插件名，loader 诊断用。 */
const name = "dsh-literature";
/** 本插件需要注入的服务。 */
const inject = ["tools", "fs"];
/** 运行时配置 schema（schemastery 应用默认值）。 */
const Config = z.object({ maxBytes: z.number().default(524288) });
/** 默认读取上限，与 Config 的默认值保持一致。 */
const DEFAULT_MAX_BYTES = 524288;
/** 校验并解析读取参数。 */
function parsePath(path) {
	if (typeof path !== "string" || path.trim().length === 0) throw new Error("path must be a non-empty string");
	return path;
}
/** 注册 `read_plain` 工具。 */
function registerReadPlain(ctx, maxBytes) {
	ctx.tools.register(defineTool({
		name: "read_plain",
		description: "读取文本文件的全部内容，不添加行号。适合完整阅读文稿、章节、笔记等文学作品文件。相对路径以当前会话的工作目录（cwd）为基准，也接受绝对路径。",
		parameters: { path: {
			type: "string",
			required: true,
			description: "要读取的文件路径。相对路径以会话工作目录（cwd）为基准，绝对路径亦可。"
		} },
		output: {
			schema: { type: "string" },
			render: (_args, value) => [{
				type: "text",
				text: value
			}]
		},
		async execute(args, exec) {
			const path = parsePath(args.path);
			const cwd = exec.agent?.session.header.cwd;
			const target = await ctx.fs.resolve(path, {
				...cwd === void 0 ? {} : { cwd },
				signal: exec.signal
			});
			const info = await ctx.fs.stat(target, exec.signal);
			if (info === void 0) throw new Error(`file not found: ${path}`);
			if (info.type !== "file") throw new Error(`not a regular file: ${path}`);
			if (info.size !== void 0 && info.size > maxBytes) throw new Error(`file is ${info.size} bytes, exceeding the read limit of ${maxBytes} bytes; use str_replace_editor view with a view_range to read it in parts`);
			const text = await ctx.fs.readText(target, exec.signal);
			ctx.emit("fs/observed", target, {
				kind: "present",
				version: info.version
			}, exec);
			return text;
		},
		isConcurrencySafe: () => true,
		presentCall(args) {
			return {
				card: "generic",
				title: `read ${args.path}`,
				kind: "read",
				locations: [{ path: args.path }]
			};
		}
	}));
}
/** 应用本插件：注册工具（注册随 fiber 自动解除）。 */
function apply(ctx, config) {
	const maxBytes = config.maxBytes ?? DEFAULT_MAX_BYTES;
	if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new Error(`dsh-literature: maxBytes must be a positive safe integer`);
	registerReadPlain(ctx, maxBytes);
}
//#endregion
export { Config, apply, inject, name };
