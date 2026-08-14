#!/usr/bin/env node
/**
 * 把文学 preset 安装到 DeepSeek Harness 的用户预设目录。
 *
 * preset 发现机制（dsh-agent-presets）只扫描 `~/.dsh/.agent-presets/`，
 * 不会从 npm 包自动发现预设。本脚本把包内 `preset/literature/` 的两个文件
 * 复制到用户预设根下的 `literature/` 目录。
 *
 * 采用复制而非符号链接，两个理由：
 * 1. 文件级符号链接在 Windows 需要开发者模式或管理员权限（普通进程
 *    EPERM），复制则零权限要求；
 * 2. 官方语义视 preset 文件为"用户输入"（composition is an input, the
 *    user edits it）——复制副本用户可自由编辑，符号链接反而会把用户的
 *    编辑写回包目录。
 *
 * 代价：包升级后需重跑本脚本使预设跟随（幂等，可重复执行）。
 */

import { copyFile, mkdir, readdir, rm } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PRESET_ID = 'literature'
const FILES = ['agent.cordis.yml', 'preset.yml']

/** 包内 preset/literature 目录（本脚本所在 scripts/ 的上一级）。 */
const packagePresetDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'preset', PRESET_ID)

/** Harness 用户预设根：$DSH_HOME/.agent-presets 或 ~/.dsh/.agent-presets。 */
function userPresetRoot() {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  return join(home, '.agent-presets')
}

async function main() {
  const root = userPresetRoot()
  const presetDir = join(root, PRESET_ID)
  await mkdir(presetDir, { recursive: true })
  // 先清理旧副本（含可能的历史符号链接），再复制当前版本。
  for (const entry of await readdir(presetDir)) {
    if (FILES.includes(entry)) await rm(join(presetDir, entry), { force: true, recursive: true })
  }
  for (const file of FILES) {
    await copyFile(join(packagePresetDir, file), join(presetDir, file))
  }
  console.log(`installed "${PRESET_ID}" preset to ${presetDir}`)
  for (const file of FILES) {
    console.log(`  ${file} <- ${join(packagePresetDir, file)}`)
  }
}

main().catch((error) => {
  console.error(`dsh-literature: install failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
