function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getNextAutoName(names: string[], baseName: string) {
  const pattern = new RegExp(`^${escapeRegExp(baseName)}_(\\d+)$`);
  let maxNum = 0;

  for (const name of names) {
    const match = name.match(pattern);
    if (!match) continue;
    const num = Number.parseInt(match[1] ?? '0', 10);
    if (num > maxNum) {
      maxNum = num;
    }
  }

  return `${baseName}_${maxNum + 1}`;
}

export function getNextRecordTypeName(names: string[]) {
  return getNextAutoName(names, '新数据源');
}

export function getNextViewName(names: string[]) {
  return getNextAutoName(names, '新视图');
}

export function getNextSceneItemName(names: string[]) {
  return getNextAutoName(names, '新图表');
}