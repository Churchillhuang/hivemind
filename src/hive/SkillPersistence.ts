/**
 * SkillPersistence - 技能持久化管理
 *
 * 负责技能文件的读写操作，包括：
 * - 保存技能到 agent_skills/<agentId>/skills.json
 * - 加载共享技能 from shared_skills/
 * - 加载特定 agent 的技能
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import type { HiveConfig } from "./HiveConfig.js";

/**
 * 技能记录
 */
export interface SkillRecord {
  name: string;
  learned: boolean;
  successRate: number;
  lastUsed: number;
  usageCount: number;
  extractedFrom?: string; // 提取自哪个任务
  extractedAt?: number; // 提取时间
  tags?: string[]; // 技能标签
  description?: string; // 技能描述
}

/**
 * 技能文件格式
 */
interface SkillFile {
  version: string;
  agentId: string;
  skills: SkillRecord[];
  lastUpdated: number;
}

/**
 * 共享技能文件格式
 */
interface SharedSkillFile {
  version: string;
  skills: Array<{
    name: string;
    description: string;
    tags: string[];
    successRate: number;
    usageCount: number;
    source: string; // 来源 agent
  }>;
  lastUpdated: number;
}

/**
 * 技能持久化管理器
 */
export class SkillPersistence {
  constructor(private config: HiveConfig) {}

  /**
   * 保存技能到 agent_skills/<agentId>/skills.json
   */
  async saveSkill(skill: SkillRecord, agentId: string): Promise<void> {
    const skillsDir = this.getAgentSkillsDir(agentId);
    await this.ensureDir(skillsDir);

    const skillFile = path.join(skillsDir, "skills.json");
    const existing = await this.loadSkillsFile(skillFile);

    // 更新或添加技能
    const index = existing.skills.findIndex((s) => s.name === skill.name);
    if (index >= 0) {
      existing.skills[index] = skill;
    } else {
      existing.skills.push(skill);
    }

    existing.lastUpdated = Date.now();

    await fs.writeFile(skillFile, JSON.stringify(existing, null, 2), "utf-8");
    console.log(`[SkillPersistence] Saved skill "${skill.name}" for agent ${agentId}`);
  }

  /**
   * 加载特定 agent 的所有技能
   */
  async loadSkills(agentId: string): Promise<SkillRecord[]> {
    const skillFile = path.join(this.getAgentSkillsDir(agentId), "skills.json");

    try {
      const data = await this.loadSkillsFile(skillFile);
      return data.skills;
    } catch {
      // 文件不存在是正常情况
      return [];
    }
  }

  /**
   * 加载共享技能（所有 agent 都可以使用的技能）
   */
  async loadSharedSkills(): Promise<SkillRecord[]> {
    const sharedFile = path.join(this.config.skillLearning.sharedSkillsPath, "shared_skills.json");

    try {
      const content = await fs.readFile(sharedFile, "utf-8");
      const data = JSON.parse(content) as SharedSkillFile;

      return data.skills.map((skill) => ({
        name: skill.name,
        learned: true,
        successRate: skill.successRate,
        lastUsed: Date.now(),
        usageCount: skill.usageCount,
        tags: skill.tags,
        description: skill.description,
      }));
    } catch {
      // 共享技能文件不存在是正常的
      return [];
    }
  }

  /**
   * 保存共享技能（更新共享技能库）
   */
  async saveSharedSkill(skill: SkillRecord, sourceAgent: string): Promise<void> {
    const sharedDir = this.config.skillLearning.sharedSkillsPath;
    await this.ensureDir(sharedDir);

    const sharedFile = path.join(sharedDir, "shared_skills.json");

    // 加载现有数据
    let data: SharedSkillFile;
    try {
      const content = await fs.readFile(sharedFile, "utf-8");
      data = JSON.parse(content) as SharedSkillFile;
    } catch {
      data = {
        version: "1.0",
        skills: [],
        lastUpdated: Date.now(),
      };
    }

    // 检查是否已存在
    const index = data.skills.findIndex((s) => s.name === skill.name);
    const sharedSkill = {
      name: skill.name,
      description: skill.description || "",
      tags: skill.tags || [],
      successRate: skill.successRate,
      usageCount: skill.usageCount,
      source: sourceAgent,
    };

    if (index >= 0) {
      data.skills[index] = sharedSkill;
    } else {
      data.skills.push(sharedSkill);
    }

    data.lastUpdated = Date.now();

    await fs.writeFile(sharedFile, JSON.stringify(data, null, 2), "utf-8");
    console.log(`[SkillPersistence] Saved shared skill "${skill.name}" from agent ${sourceAgent}`);
  }

  /**
   * 删除技能（清理低效技能）
   */
  async deleteSkill(skillName: string, agentId: string): Promise<void> {
    const skillFile = path.join(this.getAgentSkillsDir(agentId), "skills.json");

    try {
      const data = await this.loadSkillsFile(skillFile);
      const index = data.skills.findIndex((s) => s.name === skillName);

      if (index >= 0) {
        data.skills.splice(index, 1);
        data.lastUpdated = Date.now();
        await fs.writeFile(skillFile, JSON.stringify(data, null, 2), "utf-8");
        console.log(`[SkillPersistence] Deleted skill "${skillName}" from agent ${agentId}`);
      }
    } catch {
      // 文件不存在，无需删除
    }
  }

  /**
   * 列出所有可用的技能（agent 技能 + 共享技能）
   */
  async listAvailableSkills(agentId: string): Promise<{
    agentSkills: SkillRecord[];
    sharedSkills: SkillRecord[];
  }> {
    const [agentSkills, sharedSkills] = await Promise.all([
      this.loadSkills(agentId),
      this.loadSharedSkills(),
    ]);

    return { agentSkills, sharedSkills };
  }

  // Private methods

  private getAgentSkillsDir(agentId: string): string {
    return path.join(this.config.skillLearning.agentSkillsPath, agentId);
  }

  private async ensureDir(dir: string): Promise<void> {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch {
      // 目录已存在
    }
  }

  private async loadSkillsFile(filePath: string): Promise<SkillFile> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      return JSON.parse(content) as SkillFile;
    } catch {
      // 文件不存在，返回空结构
      return {
        version: "1.0",
        agentId: path.basename(path.dirname(filePath)),
        skills: [],
        lastUpdated: Date.now(),
      };
    }
  }
}
