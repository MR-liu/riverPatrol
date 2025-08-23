export const reportCategories = [
  {
    id: 'garbage',
    name: '垃圾污染',
    icon: 'delete', // Material Icons name
    color: '#EF4444', // rose-500
    items: ['生活垃圾堆积', '建筑垃圾倾倒', '漂浮垃圾', '工业废料', '其他垃圾'],
  },
  {
    id: 'facility',
    name: '设施损毁',
    icon: 'build', // Material Icons name
    color: '#6B7280', // gray-500
    items: ['护栏损坏', '标识牌缺失', '照明设施故障', '桥梁损坏', '其他设施问题'],
  },
  {
    id: 'violation',
    name: '违规行为',
    icon: 'warning', // Material Icons name
    color: '#F59E0B', // amber-500
    items: ['非法排污', '违规建设', '非法捕鱼', '倾倒废料', '其他违规行为'],
  },
  {
    id: 'water',
    name: '水质异常',
    icon: 'opacity', // Material Icons name
    color: '#10B981', // emerald-500
    items: ['水体发黑', '异味严重', '油污漂浮', '泡沫异常', '其他水质问题'],
  },
];

export type ReportCategory = typeof reportCategories[0];