/**
 * TaskDecomposer - 任务分解器
 *
 * 分析任务复杂度，将复杂任务分解成多个子任务，
 * 分配给不同的Agent并行执行，最后聚合结果
 */

import type { TaskAnnouncement, SubtaskProposal } from "./consensus-types.js";

export interface DecompositionAnalysis {
  shouldDecompose: boolean;
  reason: string;
  subtasks: SubtaskProposal[];
  estimatedComplexity: "low" | "medium" | "high";
  parallelizable: boolean; // 是否可并行执行
}

export interface DecompositionConfig {
  // 是否启用任务分解
  enabled: boolean;

  // 复杂度阈值（高于此值才分解）
  complexityThreshold: number;

  // 最小子任务数
  minSubtasks: number;

  // 最大子任务数
  maxSubtasks: number;

  // 是否允许并行执行
  allowParallel: boolean;
}

export const DEFAULT_DECOMPOSITION_CONFIG: DecompositionConfig = {
  enabled: true,
  complexityThreshold: 7,
  minSubtasks: 2,
  maxSubtasks: 5,
  allowParallel: true,
};

export class TaskDecomposer {
  private config: DecompositionConfig;

  constructor(config?: Partial<DecompositionConfig>) {
    this.config = { ...DEFAULT_DECOMPOSITION_CONFIG, ...config };
  }

  /**
   * 分析任务是否需要分解
   */
  analyzeTask(task: TaskAnnouncement): DecompositionAnalysis {
    const complexity = this.estimateComplexity(task);

    // 简单任务不分解
    if (complexity.score < this.config.complexityThreshold) {
      return {
        shouldDecompose: false,
        reason: `Task complexity (${complexity.score}) below threshold (${this.config.complexityThreshold})`,
        subtasks: [],
        estimatedComplexity: complexity.level,
        parallelizable: false,
      };
    }

    // 分析是否可以分解
    const decomposition = this.decomposeTask(task, complexity);

    return decomposition;
  }

  /**
   * 估算任务复杂度
   */
  private estimateComplexity(task: TaskAnnouncement): {
    score: number;
    level: "low" | "medium" | "high";
    factors: string[];
  } {
    let score = 0;
    const factors: string[] = [];

    // 1. 描述长度
    if (task.description.length > 200) {
      score += 3;
      factors.push("Long description");
    } else if (task.description.length > 100) {
      score += 2;
      factors.push("Medium description");
    }

    // 2. 需要的能力数量
    if (task.requiredCapabilities.length >= 3) {
      score += 3;
      factors.push(`Multiple capabilities: ${task.requiredCapabilities.length}`);
    } else if (task.requiredCapabilities.length === 2) {
      score += 1;
      factors.push("Two capabilities");
    }

    // 3. 任务类型复杂度
    const complexTypes = ["analysis", "generation", "multi_step", "comprehensive"];
    if (complexTypes.some((type) => task.taskType.includes(type))) {
      score += 2;
      factors.push("Complex task type");
    }

    // 4. 关键词检测
    const complexKeywords = [
      "分析",
      "生成",
      "创建",
      "比较",
      "评估",
      "analyze",
      "generate",
      "create",
      "compare",
      "evaluate",
      "多个",
      "全面",
      "详细",
      "深入",
      "第一步",
      "然后",
      "最后",
      "multiple",
      "comprehensive",
      "detailed",
      "step",
      "first",
      "then",
      "finally",
    ];

    const matchedKeywords = complexKeywords.filter((kw) =>
      task.description.toLowerCase().includes(kw.toLowerCase()),
    );

    if (matchedKeywords.length >= 3) {
      score += 3;
      factors.push(`Complex keywords: ${matchedKeywords.slice(0, 3).join(", ")}`);
    } else if (matchedKeywords.length >= 1) {
      score += 1;
      factors.push(`Keywords: ${matchedKeywords[0]}`);
    }

    // 确定复杂度级别
    let level: "low" | "medium" | "high";
    if (score >= 7) {
      level = "high";
    } else if (score >= 4) {
      level = "medium";
    } else {
      level = "low";
    }

    return { score, level, factors };
  }

  /**
   * 分解任务
   */
  private decomposeTask(
    task: TaskAnnouncement,
    complexity: { score: number; level: string; factors: string[] },
  ): DecompositionAnalysis {
    const subtasks: SubtaskProposal[] = [];

    // 根据能力需求分解
    if (task.requiredCapabilities.length >= 2) {
      // 为每个主要能力创建子任务
      for (
        let i = 0;
        i < Math.min(task.requiredCapabilities.length, this.config.maxSubtasks);
        i++
      ) {
        const cap = task.requiredCapabilities[i];

        subtasks.push({
          id: `subtask_${task.taskId}_${i}`,
          description: `${this.getCapabilityDescription(cap)}: ${task.description}`,
          requiredSkills: [cap],
          estimatedComplexity: "medium",
          dependencies:
            i > 0 && !this.config.allowParallel ? [`subtask_${task.taskId}_${i - 1}`] : undefined,
        });
      }
    } else {
      // 单能力任务，按步骤分解
      const steps = this.identifySteps(task.description);

      for (let i = 0; i < Math.min(steps.length, this.config.maxSubtasks); i++) {
        subtasks.push({
          id: `subtask_${task.taskId}_step${i}`,
          description: steps[i],
          requiredSkills: task.requiredCapabilities,
          estimatedComplexity: "low",
          dependencies:
            i > 0 && !this.config.allowParallel
              ? [`subtask_${task.taskId}_step${i - 1}`]
              : undefined,
        });
      }
    }

    // 确保至少有最小数量的子任务
    while (subtasks.length < this.config.minSubtasks) {
      subtasks.push({
        id: `subtask_${task.taskId}_additional_${subtasks.length}`,
        description: `Support task for: ${task.description}`,
        requiredSkills: task.requiredCapabilities,
        estimatedComplexity: "low",
      });
    }

    return {
      shouldDecompose: true,
      reason: `Complexity score ${complexity.score}: ${complexity.factors.join(", ")}`,
      subtasks,
      estimatedComplexity: complexity.level as "low" | "medium" | "high",
      parallelizable: this.config.allowParallel && subtasks.every((st) => !st.dependencies),
    };
  }

  /**
   * 识别任务步骤
   */
  private identifySteps(description: string): string[] {
    const steps: string[] = [];

    // 检查是否有明确的步骤标记
    const stepPatterns = [
      /第[一二三四五六七八九十]+步[：:](.+)/g,
      /Step \d+[:：](.+)/gi,
      /首先[,，](.+)[,，]然后[,，](.+)[,，]最后[,，](.+)/g,
      /First[,，](.+)[,，]then[,，](.+)[,，]finally[,，](.+)/gi,
    ];

    for (const pattern of stepPatterns) {
      const matches = description.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          steps.push(match[1].trim());
        }
      }
    }

    // 如果没有明确步骤，按句子分解
    if (steps.length === 0) {
      const sentences = description.split(/[。.!?！？]+/).filter((s) => s.trim().length > 0);
      if (sentences.length > 1) {
        steps.push(...sentences.map((s) => s.trim()));
      } else {
        // 单句任务，分解为分析和执行
        steps.push(`分析: ${description}`);
        steps.push(`执行: ${description}`);
      }
    }

    return steps;
  }

  /**
   * 获取能力描述
   */
  private getCapabilityDescription(capability: string): string {
    const descriptions: Record<string, string> = {
      text_processing: "处理文本内容",
      question_answering: "回答问题",
      code_analysis: "分析代码",
      documentation: "生成文档",
      file_reading: "读取文件",
      content_parsing: "解析内容",
      pattern_recognition: "识别模式",
      wordpress_api: "WordPress操作",
      html_parsing: "解析HTML",
      tagging: "添加标签",
      seo_optimization: "SEO优化",
    };

    return descriptions[capability] || capability;
  }
}
