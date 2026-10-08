import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { env } from '../env.js';

// ─── 请求 / 响应 Schema ────────────────────────────────────────────────────────

const fieldSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['text', 'longText', 'number', 'boolean', 'select', 'multiSelect', 'date', 'url']),
});

const requestBodySchema = z.object({
  /** 视图所属 RecordType 的全部字段列表（已按 fieldOrder 排好） */
  fields: z.array(fieldSchema).min(1).max(100),
});

// ─── Prompt 构造 ───────────────────────────────────────────────────────────────

/**
 * 字段类型 → 人类可读描述（用于 prompt）
 */
const FIELD_TYPE_LABELS: Record<string, string> = {
  text:        '文本',
  longText:    '长文本',
  number:      '数值',
  boolean:     '布尔（是/否）',
  select:      '单选',
  multiSelect: '多选',
  date:        '日期',
  url:         'URL',
};

function buildPrompt(fields: z.infer<typeof fieldSchema>[]): string {
  const fieldList = fields
    .map((f) => `  - id="${f.id}"  name="${f.name}"  type=${FIELD_TYPE_LABELS[f.type] ?? f.type}`)
    .join('\n');

  return `你是一个数据可视化推荐专家。用户有一批数据字段，你需要根据字段名和字段类型，从以下三种 3D 图表中推荐最合适的 1-3 种，并给出具体的字段映射方案。

## 可用图表及轴说明

1. **bar3d（3D 柱状图）**
   - xField：X 轴（类别轴），适合 text / select / date 类型字段
   - yField：Y 轴（高度/数值轴），必须是 number 类型字段
   - zField：Z 轴（可选分组轴），适合 text / select 类型字段

2. **scatter3d（3D 散点图）**
   - xField：X 轴（数值），必须是 number 类型字段
   - yField：Y 轴（数值），必须是 number 类型字段
   - zField：Z 轴（数值，可选），必须是 number 类型字段
   - colorField：颜色分组（可选），适合 text / select 类型字段
   - sizeField：点大小（可选），必须是 number 类型字段

3. **line3d（3D 折线图）**
   - xField：X 轴（类别/时间轴），适合 text / date 类型字段
   - yField：Y 轴（数值轴），必须是 number 类型字段
   - colorField：系列分组（可选），适合 text / select 类型字段

## 当前数据字段

${fieldList}

## 输出要求

以 JSON 格式返回，不要输出任何其他内容，结构如下：

{
  "recommendations": [
    {
      "chartType": "bar3d" | "scatter3d" | "line3d",
      "fieldMappings": {
        "xField": "<fieldId 或 null>",
        "yField": "<fieldId 或 null>",
        "zField": "<fieldId 或 null>",
        "colorField": "<fieldId 或 null>",
        "sizeField": "<fieldId 或 null>"
      },
      "reason": "简短说明推荐原因（一句话，中文）"
    }
  ]
}

注意：
- fieldMappings 中只需包含该图表实际使用的轴键，不需要的键可省略
- fieldId 必须使用上方字段列表中的真实 id
- recommendations 按推荐置信度从高到低排序，最多返回 3 条`;
}

// ─── 响应结构校验 ─────────────────────────────────────────────────────────────

const recommendationSchema = z.object({
  recommendations: z.array(
    z.object({
      chartType: z.enum(['bar3d', 'scatter3d', 'line3d']),
      fieldMappings: z.object({
        xField:     z.string().nullable().optional(),
        yField:     z.string().nullable().optional(),
        zField:     z.string().nullable().optional(),
        colorField: z.string().nullable().optional(),
        sizeField:  z.string().nullable().optional(),
      }),
      reason: z.string(),
    }),
  ).min(1).max(3),
});

// ─── Route plugin ─────────────────────────────────────────────────────────────

export default async function aiRoutes(app: FastifyInstance) {
  // POST /api/ai/recommend-chart
  app.post('/recommend-chart', { preHandler: [app.verifyJWT] }, async (req, reply) => {
    // 检查 AI 配置是否就绪
    if (!env.OPENAI_API_URL || !env.OPENAI_API_KEY) {
      return reply.status(503).send({ error: 'AI 服务未配置，请联系管理员设置 OPENAI_API_URL 和 OPENAI_API_KEY。' });
    }

    // 解析请求体
    let body: z.infer<typeof requestBodySchema>;
    try {
      body = requestBodySchema.parse(req.body);
    } catch (e: any) {
      return reply.status(400).send({ error: e.message });
    }

    const model = env.OPENAI_MODEL || 'gpt-4o-mini';
    const prompt = buildPrompt(body.fields);

    // 调用 OpenAI 兼容接口
    let aiRaw: string;
    try {
      const response = await fetch(`${env.OPENAI_API_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        req.log.error({ status: response.status, body: text }, 'OpenAI API error');
        return reply.status(502).send({ error: `AI 接口返回错误：${response.status}` });
      }

      const data = await response.json() as { choices?: { message?: { content?: string } }[] };
      aiRaw = data?.choices?.[0]?.message?.content ?? '';
    } catch (e: any) {
      req.log.error(e, 'Failed to call OpenAI API');
      return reply.status(502).send({ error: `调用 AI 接口失败：${e.message}` });
    }

    // 解析并校验 AI 返回的结构化数据
    let parsed: z.infer<typeof recommendationSchema>;
    try {
      parsed = recommendationSchema.parse(JSON.parse(aiRaw));
    } catch (e: any) {
      req.log.error({ raw: aiRaw, err: e.message }, 'AI response parse failed');
      return reply.status(502).send({ error: 'AI 返回格式异常，请重试。' });
    }

    return reply.send(parsed);
  });
}
