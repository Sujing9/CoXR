import { request } from './client';
import type { FieldDef } from '@coxr/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChartKind = 'bar3d' | 'scatter3d' | 'line3d';

export interface ChartFieldMappings {
  xField?: string | null;
  yField?: string | null;
  zField?: string | null;
  colorField?: string | null;
  sizeField?: string | null;
}

export interface ChartRecommendation {
  chartType: ChartKind;
  fieldMappings: ChartFieldMappings;
  reason: string;
}

export interface RecommendChartResponse {
  recommendations: ChartRecommendation[];
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const aiApi = {
  /** 根据字段列表获取 AI 图表推荐 */
  recommendChart(fields: Pick<FieldDef, 'id' | 'name' | 'type'>[]): Promise<RecommendChartResponse> {
    return request<RecommendChartResponse>('/api/ai/recommend-chart', {
      method: 'POST',
      body: { fields },
    });
  },
};
