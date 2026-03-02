(function() {
  var origin = typeof window !== 'undefined' && window.location && window.location.origin;
  var allowed = [
    'https://uidesigncandy.github.io',
    'http://localhost',
    'http://127.0.0.1'
  ];
  var ok = origin && allowed.some(function(o) {
    return origin === o || (o.length < origin.length && origin.slice(0, o.length) === o);
  });
  if (!ok) {
    document.body.innerHTML = '<div style="padding:40px;text-align:center;font-family:sans-serif;"><p style="color:#c00;font-size:18px;">请通过正式站点使用本功能</p><p style="color:#666;margin-top:12px;">请勿保存到本地或复制到其他网站使用</p></div>';
    throw new Error('Invalid origin');
  }
})();

const zone = document.getElementById('zone');
const fileInput = document.getElementById('file');
const btn = document.getElementById('btn');
const msg = document.getElementById('msg');
const previewContainer = document.getElementById('previewContainer');
const originalText = document.getElementById('originalText');
const convertedText = document.getElementById('convertedText');
const originalFormat = document.getElementById('originalFormat');
const convertedFormat = document.getElementById('convertedFormat');
let currentBlocks = []; // 保存当前的 blocks 数据
let isUpdating = false; // 防止重复更新
const downloadBtn = document.getElementById('downloadBtn');
const fullscreenPreviewBtn = document.getElementById('fullscreenPreviewBtn');
const fullscreenModal = document.getElementById('fullscreenModal');
const fullscreenPreviewContainer = document.getElementById('fullscreenPreviewContainer');
const closeFullscreenBtn = document.getElementById('closeFullscreenBtn');
let currentFile = null, currentName = '', currentFileType = '';
let convertedBlob = null, convertedFileName = '';

// 标签切换功能
document.querySelectorAll('.format-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const targetTab = tab.dataset.tab;
    document.querySelectorAll('.format-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.format-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(targetTab === 'content' ? 'contentPreview' : 'formatPreview').classList.add('active');
  });
});

function setMsg(text, type = '') {
  msg.textContent = text;
  msg.className = 'msg ' + type;
}

zone.onclick = () => fileInput.click();
zone.ondragover = (e) => { e.preventDefault(); zone.classList.add('dragover'); };
zone.ondragleave = () => zone.classList.remove('dragover');
function isValidFileType(fileName) {
  const ext = fileName.toLowerCase();
  return ext.endsWith('.docx') || ext.endsWith('.pdf') || ext.endsWith('.xlsx') || ext.endsWith('.xls');
}

function getFileType(fileName) {
  const ext = fileName.toLowerCase();
  if (ext.endsWith('.docx')) return 'docx';
  if (ext.endsWith('.pdf')) return 'pdf';
  if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) return 'excel';
  return '';
}

zone.ondrop = (e) => {
  e.preventDefault();
  zone.classList.remove('dragover');
  const f = e.dataTransfer?.files?.[0];
  if (f && isValidFileType(f.name)) setFile(f);
  else setMsg('请选择 .docx、.pdf、.xlsx 或 .xls 文件', 'err');
};
fileInput.onchange = () => { const f = fileInput.files?.[0]; if (f && isValidFileType(f.name)) setFile(f); else if (f) setMsg('不支持的文件格式', 'err'); };

function setFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    currentFile = reader.result;
    currentName = file.name;
    currentFileType = getFileType(file.name);
    btn.disabled = false;
    setMsg('已选：' + file.name + ' (' + currentFileType.toUpperCase() + ')');
    previewContainer.classList.remove('show');
    downloadBtn.style.display = 'none';
    fullscreenPreviewBtn.style.display = 'none';
    convertedBlob = null;
  };
  reader.readAsArrayBuffer(file);
}

function extractTextFromBlocks(blocks) {
  return blocks.map(b => {
    if (b.type === 'title') return '【大标题】' + b.text;
    if (b.type === 'h1') return '【一级标题】' + b.text;
    if (b.type === 'h2') return '【二级标题】' + b.text;
    if (b.type === 'h3') return '【三级标题】' + b.text;
    if (b.type === 'h4') return '【四级标题】' + b.text;
    return b.text;
  }).join('\n\n');
}

// 本地智能识别算法
function identifyHeadingsLocal(blocks) {
  const result = [];
  let currentLevel = 0;
  const levelStack = [];
  
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const text = block.text || '';
    
    // 跳过完全空白的文本块，但保留有内容的文本（包括空白字符）
    if (!text || text.trim().length === 0) continue;
    
    // 如果已经是标题类型，保留
    if (['h1', 'h2', 'h3', 'h4'].includes(block.type)) {
      result.push(block);
      continue;
    }
    
    // 智能识别标题特征
    const isHeading = detectHeading(text, i, blocks);
    
    if (isHeading) {
      // 确定标题级别
      const level = determineHeadingLevel(text, i, blocks, levelStack);
      result.push({
        type: `h${level}`,
        text: text
      });
      levelStack.push(level);
    } else {
      result.push({
        type: 'p',
        text: text
      });
    }
  }
  
  return result;
}

// 检测是否是标题（改进版：更保守，避免误判正文为标题）
function detectHeading(text, index, blocks) {
  const trimmedText = text.trim();
  if (!trimmedText || trimmedText.length > 200) return false;
  
  // 排除明显是正文的情况
  // 1. 如果包含多个完整句子（句号、问号、感叹号），很可能是正文
  const sentenceEndings = (trimmedText.match(/[。！？]/g) || []).length;
  if (sentenceEndings > 1) return false;
  
  // 2. 如果文本很长且包含详细描述，很可能是正文
  if (trimmedText.length > 100 && (
    trimmedText.includes('具体') || 
    trimmedText.includes('详细') ||
    trimmedText.includes('例如') ||
    trimmedText.includes('比如') ||
    trimmedText.includes('说明') ||
    trimmedText.includes('介绍')
  )) {
    return false;
  }
  
  // 3. 如果文本以句号结尾且长度较长，很可能是正文
  if (trimmedText.endsWith('。') && trimmedText.length > 50) {
    return false;
  }
  
  // 1. 检查编号模式（最可靠的标题特征）
  const numberingPatterns = [
    /^[一二三四五六七八九十]+[、．]/,           // 一、二、三、
    /^第[一二三四五六七八九十]+[章节部分条款项]/,
    /^[（(][一二三四五六七八九十]+[）)]/,         // （一）（二）
    /^\d+[、．]/,                              // 1. 2. 3.
    /^第\d+[章节部分条款项]/,
    /^[（(]\d+[）)]/,                           // (1) (2)
    /^[（(][A-Za-z][）)]/,                      // (a) (b)
    /^[A-Za-z][、．]/,                         // a. b.
    /^[①②③④⑤⑥⑦⑧⑨⑩]/                          // 圆圈数字
  ];
  
  if (numberingPatterns.some(pattern => pattern.test(trimmedText))) {
    // 如果有序号，但后面跟着很长的正文内容，可能是正文
    const afterNumbering = trimmedText.replace(/^[一二三四五六七八九十]+[、．]/, '')
                                      .replace(/^[（(][一二三四五六七八九十]+[）)]/, '')
                                      .replace(/^\d+[、．]/, '')
                                      .replace(/^[（(]\d+[）)]/, '')
                                      .trim();
    // 如果序号后的内容超过80字或包含句号，可能是正文
    if (afterNumbering.length > 80 || afterNumbering.includes('。')) {
      return false;
    }
    return true;
  }
  
  // 2. 检查明确的标题关键词（只检查开头，且要求短文本）
  const strongTitleKeywords = [
    '第一章', '第二章', '第三章', '第四章', '第五章',
    '第一节', '第二节', '第三节', '第四节',
    '第一部分', '第二部分', '第三部分', '第四部分',
    '目录', '前言', '概述', '摘要', '绪论'
  ];
  
  for (const keyword of strongTitleKeywords) {
    if (trimmedText.startsWith(keyword) && trimmedText.length < 60) {
      return true;
    }
  }
  
  // 3. 上下文分析：检查前后文关系（更严格的判断）
  let contextScore = 0;
  
  // 检查下一段是否是正文
  if (index < blocks.length - 1) {
    const nextBlock = blocks[index + 1];
    const nextText = nextBlock ? (nextBlock.text || '').trim() : '';
    // 如果下一段是长文本（>100字）或包含多个句子，当前短文本可能是标题
    if (nextText.length > 100 || (nextText.match(/[。！？]/g) || []).length > 1) {
      contextScore += 2;
    }
  }
  
  // 检查上一段是否是标题
  if (index > 0) {
    const prevBlock = blocks[index - 1];
    if (prevBlock && ['h1', 'h2', 'h3', 'h4'].includes(prevBlock.type)) {
      // 如果上一段是标题，当前短文本也可能是标题
      if (trimmedText.length < 60) {
        contextScore += 1;
      }
    }
    // 如果上一段是长正文，当前短文本可能是标题
    const prevText = prevBlock ? (prevBlock.text || '').trim() : '';
    if (prevText.length > 100 && trimmedText.length < 50) {
      contextScore += 1;
    }
  }
  
  // 4. 综合判断（更严格的条件）
  // 必须是短文本（<60字），且上下文强烈支持，且不包含详细描述
  if (trimmedText.length < 60 && contextScore >= 2) {
    // 排除包含详细描述的文本
    if (!trimmedText.includes('具体') && 
        !trimmedText.includes('详细') &&
        !trimmedText.includes('例如') &&
        !trimmedText.includes('比如')) {
      return true;
    }
  }
  
  // 5. 检查是否以冒号结尾且是短文本（可能是标题）
  if ((trimmedText.endsWith('：') || trimmedText.endsWith(':')) && trimmedText.length < 50) {
    // 但排除包含详细描述的文本
    if (!trimmedText.includes('具体') && !trimmedText.includes('详细')) {
      return true;
    }
  }
  
  return false;
}

// 确定标题级别（基于语义和序号的智能判断）
function determineHeadingLevel(text, index, blocks, levelStack) {
  const trimmedText = text.trim();
  
  // 提取序号信息
  const numberingInfo = extractNumberingInfo(trimmedText);
  
  // 1. 首先根据序号模式判断（最可靠）
  if (numberingInfo) {
    const level = determineLevelByNumbering(numberingInfo, index, blocks, levelStack);
    if (level) return level;
  }
  
  // 2. 根据语义关键词判断级别
  const semanticLevel = determineLevelBySemantics(trimmedText, index, blocks, levelStack);
  if (semanticLevel) return semanticLevel;
  
  // 3. 根据位置和上下文判断
  return determineLevelByContext(trimmedText, index, blocks, levelStack);
}

// 提取序号信息
function extractNumberingInfo(text) {
  // 中文数字编号：一、二、三、
  const match1 = text.match(/^([一二三四五六七八九十]+)[、．.]/);
  if (match1) {
    return { type: 'chinese-num', value: match1[1], pattern: match1[0] };
  }
  
  // 带括号的中文数字：（一）（二）
  const match2 = text.match(/^[（(]([一二三四五六七八九十]+)[）)]/);
  if (match2) {
    return { type: 'chinese-num-bracket', value: match2[1], pattern: match2[0] };
  }
  
  // 阿拉伯数字编号：1. 2. 3.
  const match3 = text.match(/^(\d+)[、．.]/);
  if (match3) {
    return { type: 'arabic-num', value: parseInt(match3[1]), pattern: match3[0] };
  }
  
  // 带括号的阿拉伯数字：(1) (2)
  const match4 = text.match(/^[（(](\d+)[）)]/);
  if (match4) {
    return { type: 'arabic-num-bracket', value: parseInt(match4[1]), pattern: match4[0] };
  }
  
  // 字母编号：a. b. 或 (a) (b)
  const match5 = text.match(/^[（(]([A-Za-z])[）)]/);
  if (match5) {
    return { type: 'letter-bracket', value: match5[1], pattern: match5[0] };
  }
  
  const match6 = text.match(/^([A-Za-z])[、．.]/);
  if (match6) {
    return { type: 'letter', value: match6[1], pattern: match6[0] };
  }
  
  // 圆圈数字：①②③
  const match7 = text.match(/^([①②③④⑤⑥⑦⑧⑨⑩])/);
  if (match7) {
    const circleNums = '①②③④⑤⑥⑦⑧⑨⑩';
    return { type: 'circle-num', value: circleNums.indexOf(match7[1]) + 1, pattern: match7[1] };
  }
  
  // 章节编号：第一章、第一节
  const match8 = text.match(/^第([一二三四五六七八九十]+)[章节部分]/);
  if (match8) {
    return { type: 'chapter', value: match8[1], pattern: match8[0] };
  }
  
  return null;
}

// 根据序号判断级别（严格按照编号格式规则）
function determineLevelByNumbering(numberingInfo, index, blocks, levelStack) {
  const prevLevel = levelStack.length > 0 ? levelStack[levelStack.length - 1] : 0;
  const type = numberingInfo.type;
  
  // 中文数字编号 "一、二、三、" - 自动识别为一级标题
  if (type === 'chinese-num') {
    // 无论上下文如何，"一、"格式的编号都是一级标题
    return 1;
  }
  
  // 带括号的中文数字 "（一）（二）（三）" - 自动识别为二级标题
  if (type === 'chinese-num-bracket') {
    // 无论上下文如何，"（一）"格式的编号都是二级标题
    return 2;
  }
  
  // 阿拉伯数字编号 "1. 2. 3." - 自动识别为三级标题
  if (type === 'arabic-num') {
    // 无论上下文如何，"1."格式的编号都是三级标题
    return 3;
  }
  
  // 带括号的阿拉伯数字 "(1)" - 通常是三级或四级标题
  if (type === 'arabic-num-bracket') {
    // 如果前面没有标题，可能是三级
    if (prevLevel === 0) return 3;
    // 如果前面是一级标题，可能是三级
    if (prevLevel === 1) return 3;
    // 如果前面是二级标题，可能是三级
    if (prevLevel === 2) return 3;
    // 如果前面是三级标题，可能是四级
    if (prevLevel === 3) return 4;
    return Math.min(prevLevel + 1, 4);
  }
  
  // 字母编号 "a." 或 "(a)" - 通常是四级标题
  if (type === 'letter' || type === 'letter-bracket') {
    // 如果前面没有标题，可能是四级
    if (prevLevel === 0) return 4;
    // 通常是四级标题
    return Math.min(prevLevel + 1, 4);
  }
  
  // 圆圈数字 - 通常是三级或四级标题
  if (type === 'circle-num') {
    if (prevLevel === 0) return 3;
    return Math.min(prevLevel + 1, 4);
  }
  
  // 章节编号 "第一章" - 通常是一级标题
  if (type === 'chapter') {
    return 1;
  }
  
  return null;
}

// 根据语义关键词判断级别
function determineLevelBySemantics(text, index, blocks, levelStack) {
  const prevLevel = levelStack.length > 0 ? levelStack[levelStack.length - 1] : 0;
  
  // 一级标题语义关键词
  const h1Keywords = [
    '第一章', '第二章', '第三章', '第四章', '第五章',
    '第一部分', '第二部分', '第三部分', '第四部分',
    '总体', '概述', '前言', '目录', '摘要', '绪论'
  ];
  
  // 二级标题语义关键词
  const h2Keywords = [
    '第一节', '第二节', '第三节', '第四节',
    '第一项', '第二项', '第三项',
    '总体要求', '基本原则', '主要任务', '工作目标',
    '组织领导', '工作安排', '实施步骤'
  ];
  
  // 三级标题语义关键词
  const h3Keywords = [
    '具体措施', '实施步骤', '保障措施', '工作要求',
    '工作内容', '工作方法', '工作重点', '注意事项'
  ];
  
  // 四级标题语义关键词
  const h4Keywords = [
    '详细说明', '具体要求', '注意事项', '补充说明'
  ];
  
  // 检查一级标题关键词
  if (h1Keywords.some(kw => text.includes(kw))) {
    if (prevLevel === 0) return 1;
    // 如果包含"第一章"等，强制为一级
    if (text.match(/第[一二三四五六七八九十]+章/)) return 1;
    return Math.min(prevLevel, 1);
  }
  
  // 检查二级标题关键词
  if (h2Keywords.some(kw => text.includes(kw))) {
    if (prevLevel === 0) return 2;
    if (prevLevel === 1) return 2;
    return Math.min(prevLevel + 1, 2);
  }
  
  // 检查三级标题关键词
  if (h3Keywords.some(kw => text.includes(kw))) {
    if (prevLevel <= 2) return 3;
    return Math.min(prevLevel + 1, 3);
  }
  
  // 检查四级标题关键词
  if (h4Keywords.some(kw => text.includes(kw))) {
    return Math.min(prevLevel + 1, 4);
  }
  
  return null;
}

// 根据上下文判断级别
function determineLevelByContext(text, index, blocks, levelStack) {
  const prevLevel = levelStack.length > 0 ? levelStack[levelStack.length - 1] : 0;
  
  // 如果是最前面的短文本，且没有嵌套编号，更可能是一级标题
  if (index === 0 || (index < 3 && text.length < 50 && !text.match(/^[（(]/))) {
    return 1;
  }
  
  // 根据当前层级栈判断
  if (levelStack.length === 0) {
    return 1;
  }
  
  // 如果文本很短（少于30字），可能是下一级标题
  if (text.length < 30) {
    return Math.min(prevLevel + 1, 4);
  }
  
  // 如果文本中等长度（30-60字），可能是同级或下一级
  if (text.length < 60) {
    // 检查是否包含冒号（标题特征）
    if (text.includes('：') || text.includes(':')) {
      return Math.min(prevLevel + 1, 4);
    }
    return prevLevel;
  }
  
  // 如果文本较长，可能是同级标题
  return prevLevel;
}

function generateFormatInfo(blocks, isOriginal = false) {
  if (isOriginal) {
    const stats = {
      totalBlocks: blocks.length,
      paragraphs: blocks.filter(b => b.type === 'p' || b.type === 'text').length,
      title: blocks.filter(b => b.type === 'title').length,
      h1: blocks.filter(b => b.type === 'h1').length,
      h2: blocks.filter(b => b.type === 'h2').length,
      h3: blocks.filter(b => b.type === 'h3' || b.type === 'h4').length,
      images: blocks.filter(b => b.type === 'image').length,
    };
    return `
      <h4>文件信息</h4>
      <div class="format-info-item"><strong>文件类型：</strong>${currentFileType.toUpperCase()}</div>
      <div class="format-info-item"><strong>文件名：</strong>${currentName}</div>
      <div class="format-info-item"><strong>总段落数：</strong>${stats.totalBlocks}</div>
      <div class="format-info-item"><strong>正文段落：</strong>${stats.paragraphs}</div>
      <div class="format-info-item"><strong>大标题：</strong>${stats.title}</div>
      <div class="format-info-item"><strong>一级标题：</strong>${stats.h1}</div>
      <div class="format-info-item"><strong>二级标题：</strong>${stats.h2}</div>
      <div class="format-info-item"><strong>三级标题：</strong>${stats.h3}</div>
      <div class="format-info-item"><strong>图片：</strong>${stats.images}</div>
      <h4 style="margin-top: 16px;">格式说明</h4>
      <div class="format-info-item">原文件保持原有格式，未进行格式转换</div>
    `;
  } else {
    return `
      <h4>页面设置</h4>
      <div class="format-info-item"><strong>纸张：</strong>A4</div>
      <div class="format-info-item"><strong>页边距：</strong>上 3.7cm，下 2.8cm，左 2.8cm，右 2.8cm</div>
      <h4 style="margin-top: 16px;">标题格式</h4>
      <div class="format-info-item"><strong>大标题：</strong>文档第一个标题，方正小标宋简体，二号（22磅），行距固定值 30 磅，居中，无缩进，大标题下空一行</div>
      <div class="format-info-item"><strong>一级标题：</strong>黑体，三号（16磅），加粗，行距固定值 28 磅，左对齐，首行缩进 2 个字符，编号格式：一、二、三、...</div>
      <div class="format-info-item"><strong>二级标题：</strong>楷体_GB2312，三号（16磅），行距固定值 28 磅，左对齐，首行缩进 2 个字符，编号格式：（一）（二）（三）...</div>
      <div class="format-info-item"><strong>三级标题：</strong>宋_GB2312，三号（16磅），加粗，行距固定值 28 磅，左对齐，首行缩进 2 个字符，编号格式：1. 2. 3. ...</div>
      <h4 style="margin-top: 16px;">正文格式</h4>
      <div class="format-info-item"><strong>字体：</strong>仿宋_GB2312，三号（16磅），行距固定值 28 磅，左对齐，首行缩进 2 个字符</div>
      <h4 style="margin-top: 16px;">图片格式</h4>
      <div class="format-info-item"><strong>行距：</strong>单倍行距（1倍行距）</div>
      <h4 style="margin-top: 16px;">特殊格式</h4>
      <div class="format-info-item"><strong>阿拉伯数字：</strong>全文阿拉伯数字使用 Times New Roman 字体</div>
      <div class="format-info-item"><strong>序号保留：</strong>文档中的序号在转换后会完整保留</div>
      <h4 style="margin-top: 16px;">格式规范</h4>
      <div class="format-info-item">符合 GB/T 9704-2012《党政机关公文格式》标准</div>
    `;
  }
}

const GONGWEN = {
  marginTop: '3.7cm', marginBottom: '2.8cm', marginLeft: '2.8cm', marginRight: '2.8cm',
  // docx.js 使用半磅（half-points）单位，需要将磅数乘以2
  titleSize: 44,  // 二号字体 22磅 = 44半磅
  bodySize: 32,   // 三号字体 16磅 = 32半磅
  h1Size: 32,     // 三号字体 16磅 = 32半磅
  h2Size: 32,     // 三号字体 16磅 = 32半磅
  h3Size: 32,     // 三号字体 16磅 = 32半磅
  titleLineSpacing: 600, h1LineSpacing: 560, bodyLineSpacing: 560,
  fontTitle: '方正小标宋简体', fontBody: '仿宋_GB2312', fontH1: '黑体', fontH2: '楷体_GB2312', fontH3: '宋_GB2312',
  fontNumber: 'Times New Roman',
};

function parseHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const blocks = [];
  
  function walk(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName.toLowerCase();
    
    // 优先处理标题标签（h1-h4），这些是明确的标题
    if (['h1','h2','h3','h4'].includes(tag)) {
      const text = node.textContent.trim();
      if (text) {
        blocks.push({ type: tag, text });
      }
      return; // 不继续遍历子节点
    }
    
    // 处理列表项（保留序号和内容）
    if (tag === 'li') {
      // 获取完整的文本内容，包括序号
      let text = '';
      
      // 首先尝试获取父元素（ol）的序号信息
      const parent = node.parentElement;
      const isOrderedList = parent && parent.tagName === 'OL';
      
      // 方法1: 直接获取完整文本内容（最可靠的方法，保留所有内容包括中文数字序号）
      text = node.textContent || node.innerText || '';
      text = text.trim();
      
      // 方法2: 如果 textContent 为空或没有序号，尝试从子节点提取
      if (!text || text.length === 0) {
        const textParts = [];
        function collectText(n) {
          if (n.nodeType === Node.TEXT_NODE) {
            const t = n.textContent.trim();
            if (t) textParts.push(t);
          } else if (n.nodeType === Node.ELEMENT_NODE) {
            // 提取所有文本节点
            const tagName = n.tagName.toLowerCase();
            if (['span', 'strong', 'em', 'b', 'i', 'p', 'div'].includes(tagName)) {
              const t = n.textContent.trim();
              if (t) textParts.push(t);
            } else {
              n.childNodes.forEach(collectText);
            }
          }
        }
        node.childNodes.forEach(collectText);
        text = textParts.join(' ').trim();
      }
      
      // 方法3: 检查是否有明确的序号标记（mammoth.js 可能生成的格式）
      if (!text || text.length === 0) {
        const listMarker = node.querySelector('span[class*="list"], span[style*="list"], span[class*="numbering"], span[class*="num"]');
        if (listMarker) {
          const markerText = listMarker.textContent.trim();
          const contentText = node.textContent.replace(markerText, '').trim();
          text = markerText + (contentText ? ' ' + contentText : '');
        }
      }
      
      // 检查文本中是否已经有序号（包括中文数字序号）
      const hasChineseNumber = /^[一二三四五六七八九十]+[、．.)）]/.test(text);
      const hasArabicNumber = /^\d+[、．.)）]/.test(text);
      const hasBracketChinese = /^[（(][一二三四五六七八九十]+[）)]/.test(text);
      const hasBracketArabic = /^[（(]\d+[）)]/.test(text);
      const hasAnyNumber = hasChineseNumber || hasArabicNumber || hasBracketChinese || hasBracketArabic;
      
      // 方法4: 如果是有序列表且文本中完全没有序号，才添加序号
      // 重要：如果文本中已经有中文数字序号（如"一、"），必须保留，不要添加新的序号
      if (isOrderedList && (!text || !hasAnyNumber)) {
        // 检查是否有 value 属性（HTML5 有序列表）
        const value = node.getAttribute('value');
        if (value) {
          const listIndex = parseInt(value);
          // 检查前面的列表项使用的是什么格式的序号
          const prevSibling = node.previousElementSibling;
          let useChineseNumber = false;
          if (prevSibling) {
            const prevText = prevSibling.textContent.trim();
            // 如果前一个列表项使用中文数字，当前也使用中文数字
            if (/^[一二三四五六七八九十]+[、．.)）]/.test(prevText) || /^[（(][一二三四五六七八九十]+[）)]/.test(prevText)) {
              useChineseNumber = true;
            }
          }
          
          if (useChineseNumber) {
            // 使用中文数字
            const chineseNumbers = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
            const chineseNum = listIndex <= 10 ? chineseNumbers[listIndex - 1] : listIndex.toString();
            text = chineseNum + '、' + text;
          } else {
            // 使用阿拉伯数字
            text = listIndex + '. ' + text;
          }
        } else {
          // 尝试从父列表的 start 属性和当前索引计算序号
          const parentStart = parent.getAttribute('start') ? parseInt(parent.getAttribute('start')) : 1;
          const siblings = Array.from(parent.children);
          const index = siblings.indexOf(node);
          if (index >= 0) {
            // 检查前面的列表项使用的是什么格式的序号
            let useChineseNumber = false;
            if (index > 0) {
              const prevSibling = siblings[index - 1];
              const prevText = prevSibling.textContent.trim();
              // 如果前一个列表项使用中文数字，当前也使用中文数字
              if (/^[一二三四五六七八九十]+[、．.)）]/.test(prevText) || /^[（(][一二三四五六七八九十]+[）)]/.test(prevText)) {
                useChineseNumber = true;
              }
            }
            
            if (useChineseNumber) {
              // 使用中文数字
              const chineseNumbers = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
              const listIndex = parentStart + index;
              const chineseNum = listIndex <= 10 ? chineseNumbers[listIndex - 1] : listIndex.toString();
              text = chineseNum + '、' + text;
            } else {
              // 使用阿拉伯数字
              text = (parentStart + index) + '. ' + text;
            }
          }
        }
      }
      
      // 如果文本仍然为空，使用 innerHTML 作为最后手段
      if (!text || text.length === 0) {
        text = node.innerText || node.textContent || '';
        text = text.trim();
      }
      
      if (text) {
        blocks.push({ type: 'p', text });
      }
      return; // 不继续遍历子节点
    }
    
    // 处理有序列表和无序列表（遍历子节点以保留序号）
    if (tag === 'ol' || tag === 'ul') {
      node.childNodes.forEach(walk);
      return;
    }
    
    // 处理段落，保留所有文本内容（包括序号）
    if (tag === 'p') {
      // 获取完整文本内容，确保包含所有子节点的文本（包括序号）
      let text = '';
      
      // 方法1: 优先使用 textContent 获取完整文本（包括隐藏的序号）
      text = node.textContent || '';
      text = text.trim();
      
      // 方法2: 如果 textContent 为空或可能丢失了内容，使用 innerText
      if (!text || text.length === 0) {
        text = node.innerText ? node.innerText.trim() : '';
      }
      
      // 方法3: 如果还是为空，遍历所有子节点提取文本（确保不遗漏任何内容）
      if (!text || text.length === 0) {
        const textParts = [];
        function extractText(n) {
          if (n.nodeType === Node.TEXT_NODE) {
            const t = n.textContent.trim();
            if (t) textParts.push(t);
          } else if (n.nodeType === Node.ELEMENT_NODE) {
            const tagName = n.tagName.toLowerCase();
            // 对于所有内联元素，提取其文本
            if (['span', 'strong', 'em', 'b', 'i', 'u', 'sub', 'sup'].includes(tagName)) {
              const t = n.textContent.trim();
              if (t) textParts.push(t);
            } else {
              // 对于其他元素，递归提取
              n.childNodes.forEach(extractText);
            }
          }
        }
        node.childNodes.forEach(extractText);
        text = textParts.join('').trim(); // 不使用空格连接，保持原始格式
      }
      
      // 方法4: 最后尝试使用 innerHTML 提取（作为最后手段）
      if (!text || text.length === 0) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = node.innerHTML;
        text = tempDiv.textContent || tempDiv.innerText || '';
        text = text.trim();
      }
      
      if (!text || text.length === 0) {
        // 如果段落为空，继续遍历子节点（可能有其他元素）
        node.childNodes.forEach(walk);
        return;
      }
      
      // 检查段落样式名称或类名
      const styleName = node.getAttribute('style-name') || '';
      const className = node.className || '';
      
      // 根据样式名称判断标题级别（Word文档中的样式）
      if (styleName.includes('标题 1') || styleName.includes('Title') || 
          styleName.includes('Heading 1') || className.includes('heading1')) {
        blocks.push({ type: 'h1', text });
      } else if (styleName.includes('标题 2') || styleName.includes('Heading 2') || 
                 className.includes('heading2')) {
        blocks.push({ type: 'h2', text });
      } else if (styleName.includes('标题 3') || styleName.includes('Heading 3') || 
                 className.includes('heading3')) {
        blocks.push({ type: 'h3', text });
      } else if (styleName.includes('标题 4') || styleName.includes('Heading 4') || 
                 className.includes('heading4')) {
        blocks.push({ type: 'h4', text });
      } else {
        // 普通段落（保留所有文本，包括序号）
        blocks.push({ type: 'p', text });
      }
      return; // 不继续遍历子节点，避免重复提取
    }
    
    // 对于其他块级元素（div等），提取文本内容
    if (['div', 'section', 'article'].includes(tag)) {
      const text = node.textContent.trim();
      if (text) {
        // 检查是否有标题相关的类名或属性
        const className = node.className || '';
        if (className.includes('heading') || className.includes('title')) {
          // 可能是标题，但不确定级别，标记为段落，后续由智能识别处理
          blocks.push({ type: 'p', text });
        } else {
          blocks.push({ type: 'p', text });
        }
      } else {
        // 如果div为空，继续遍历子节点
        node.childNodes.forEach(walk);
      }
      return;
    }
    
    // 处理图片标签
    if (tag === 'img') {
      const src = node.getAttribute('src') || '';
      if (src) {
        blocks.push({ type: 'image', src });
      }
      return; // 不继续遍历子节点
    }
    
    // 处理图片标签
    if (tag === 'img') {
      const src = node.getAttribute('src') || '';
      if (src) {
        blocks.push({ type: 'image', src });
      }
      return; // 不继续遍历子节点
    }
    
    // 对于其他标签（span、strong、em等内联元素），继续遍历子节点
    node.childNodes.forEach(walk);
  }
  
  walk(doc.body);
  
  // 如果没有提取到任何内容，尝试提取body的文本
  if (blocks.length === 0 && doc.body) {
    const t = doc.body.textContent.trim();
    if (t) {
      blocks.push({ type: 'p', text: t });
    }
  }
  
  return blocks;
}

async function buildParagraphs(blocks) {
  const { Document, Packer, Paragraph, TextRun, Media, ImageRun } = await import('https://esm.sh/docx@9.5.0');
  
  function splitTextWithNumbers(text, baseFont, baseSize, bold = false) {
    const runs = [];
    // 匹配数字：整数、小数、百分比等
    const regex = /(\d+(?:\.\d+)?(?:%|‰)?)/g;
    let lastIndex = 0;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        const chineseText = text.substring(lastIndex, match.index);
        if (chineseText) {
          runs.push(new TextRun({ text: chineseText, font: baseFont, size: baseSize, bold }));
        }
      }
      // 数字使用 Times New Roman 字体，保持原有字号和加粗状态
      runs.push(new TextRun({ text: match[0], font: GONGWEN.fontNumber, size: baseSize, bold }));
      lastIndex = regex.lastIndex;
    }
    
    if (lastIndex < text.length) {
      const remainingText = text.substring(lastIndex);
      if (remainingText) {
        runs.push(new TextRun({ text: remainingText, font: baseFont, size: baseSize, bold }));
      }
    }
    
    return runs.length > 0 ? runs : [new TextRun({ text, font: baseFont, size: baseSize, bold })];
  }
  const out = [];
  let firstTitleFound = false;
  
  // 处理所有块
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const text = b.text || '';
    // 只跳过完全空白的文本块，保留有内容的文本
    if (!text || text.trim().length === 0) continue;
    
    // 如果标记为大标题，使用大标题格式
    if (b.type === 'title') {
      const runs = splitTextWithNumbers(text, GONGWEN.fontTitle, GONGWEN.titleSize);
      out.push(new Paragraph({ children: runs, alignment: 'center', spacing: { line: GONGWEN.titleLineSpacing, lineRule: 'exact' } }));
      // 大标题下空一行
      out.push(new Paragraph({ children: [new TextRun({ text: '' })], spacing: { line: GONGWEN.titleLineSpacing, lineRule: 'exact' } }));
      firstTitleFound = true;
      continue;
    }
    
    // 如果还没有找到大标题，第一个标题（h1-h4或第一个段落）作为大标题
    if (!firstTitleFound) {
      firstTitleFound = true;
      const runs = splitTextWithNumbers(text, GONGWEN.fontTitle, GONGWEN.titleSize);
      out.push(new Paragraph({ children: runs, alignment: 'center', spacing: { line: GONGWEN.titleLineSpacing, lineRule: 'exact' } }));
      // 大标题下空一行
      out.push(new Paragraph({ children: [new TextRun({ text: '' })], spacing: { line: GONGWEN.titleLineSpacing, lineRule: 'exact' } }));
      continue; // 跳过第一个标题，不重复处理
    }
    
    // 如果是标题类型，直接处理（除大标题外，所有标题首行缩进2个字符）
    if (b.type === 'h1') {
      const runs = splitTextWithNumbers(text, GONGWEN.fontH1, GONGWEN.h1Size, true);
      out.push(new Paragraph({ 
        children: runs, 
        alignment: 'left', 
        spacing: { line: GONGWEN.h1LineSpacing, lineRule: 'exact' },
        indent: { firstLine: 640 }  // 首行缩进2个字符
      }));
      continue;
    }
    if (b.type === 'h2') {
      const runs = splitTextWithNumbers(text, GONGWEN.fontH2, GONGWEN.h2Size);
      out.push(new Paragraph({ 
        children: runs, 
        alignment: 'left', 
        spacing: { line: GONGWEN.bodyLineSpacing, lineRule: 'exact' },
        indent: { firstLine: 640 }  // 首行缩进2个字符
      }));
      continue;
    }
    if (b.type === 'h3') {
      const runs = splitTextWithNumbers(text, GONGWEN.fontH3, GONGWEN.h3Size, true);
      out.push(new Paragraph({ 
        children: runs, 
        alignment: 'left', 
        spacing: { line: GONGWEN.bodyLineSpacing, lineRule: 'exact' },
        indent: { firstLine: 640 }  // 首行缩进2个字符
      }));
      continue;
    }
    // h4映射到h3处理
    if (b.type === 'h4') {
      b.type = 'h3'; // 将h4映射为h3
    }
    
    if (b.type === 'h3') {
      const runs = splitTextWithNumbers(text, GONGWEN.fontH3, GONGWEN.h3Size, true);
      out.push(new Paragraph({ 
        children: runs, 
        alignment: 'left', 
        spacing: { line: GONGWEN.bodyLineSpacing, lineRule: 'exact' },
        indent: { firstLine: 640 }  // 首行缩进2个字符
      }));
      continue;
    }
    
    // 处理图片类型
    if (b.type === 'image') {
      try {
        // 处理 base64 图片
        if (b.src.startsWith('data:')) {
          const base64Match = b.src.match(/^data:image\/(\w+);base64,(.+)$/);
          if (base64Match) {
            const imageTypeStr = base64Match[1].toLowerCase();
            const base64Data = base64Match[2];
            const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            
            // 确定图片类型（docx.js 支持的格式：png, jpeg, gif, bmp, svg）
            let imageType = 'png';
            if (imageTypeStr === 'jpeg' || imageTypeStr === 'jpg') {
              imageType = 'jpeg';
            } else if (imageTypeStr === 'gif') {
              imageType = 'gif';
            } else if (imageTypeStr === 'bmp') {
              imageType = 'bmp';
            } else if (imageTypeStr === 'svg') {
              imageType = 'svg';
            }
            
            // 创建图片运行，单倍行距（1倍行距）
            const imageRun = new ImageRun({
              data: imageBuffer,
              type: imageType,
              transformation: {
                width: 400,  // 默认宽度，可以根据需要调整
                height: 300,  // 默认高度，可以根据需要调整
              }
            });
            
            // 图片段落使用单倍行距（1倍行距 = 240 twips，对于12磅字体）
            // 单倍行距：line: 240 twips (12磅 * 20 twips/磅)
            out.push(new Paragraph({
              children: [imageRun],
              alignment: 'center',  // 图片居中
              spacing: { 
                line: 240,  // 单倍行距（1倍行距 = 240 twips）
                lineRule: 'atLeast'  // 至少单倍行距
              }
            }));
          }
        }
      } catch (error) {
        console.error('Error processing image:', error);
        // 如果图片处理失败，跳过
      }
      continue;
    }
    
    // 对于段落或文本类型，作为正文处理
    if (b.type === 'p' || b.type === 'text') {
      const runs = splitTextWithNumbers(text, GONGWEN.fontBody, GONGWEN.bodySize);
      // 正文段落首行缩进2个字符（三号字体16磅，2字符 = 2 * 16 * 20 = 640 twips）
      out.push(new Paragraph({ 
        children: runs, 
        spacing: { line: GONGWEN.bodyLineSpacing, lineRule: 'exact' },
        indent: { firstLine: 640 }  // 首行缩进2个字符
      }));
    }
  }
  return { Document, Packer, Paragraph, TextRun, ImageRun, out };
}

async function processDocx(arrayBuffer) {
  const mammoth = (await import('https://esm.sh/mammoth@1.8.0')).default;
  // 使用样式映射来保留更多格式信息，并保留列表和序号
  const options = {
    styleMap: [
      "p[style-name='标题 1'] => h1",
      "p[style-name='标题 2'] => h2",
      "p[style-name='标题 3'] => h3",
      "p[style-name='标题 4'] => h4",
      "p[style-name='Title'] => h1",
      "p[style-name='Heading 1'] => h1",
      "p[style-name='Heading 2'] => h2",
      "p[style-name='Heading 3'] => h3",
    ],
    // 保留列表格式和序号（重要：确保列表被正确转换）
    includeDefaultStyleMap: true,
    // 确保列表被转换为 HTML 列表标签
    transformDocument: function(document) {
      // mammoth.js 默认会保留列表，这里不需要额外处理
      return document;
    },
    convertImage: mammoth.images.imgElement(function(image) {
      return image.read("base64").then(function(imageBuffer) {
        return {
          src: "data:" + image.contentType + ";base64," + imageBuffer
        };
      });
    })
  };
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer }, options);
  
  // 临时调试：检查 HTML 中是否包含列表
  // console.log('HTML content:', html.substring(0, 2000));
  
  return parseHtml(html);
}

async function processPdf(arrayBuffer) {
  const pdfjsLib = await import('https://esm.sh/pdfjs-dist@4.0.379');
  const { getDocument } = pdfjsLib;
  const pdf = await getDocument({ data: arrayBuffer }).promise;
  const blocks = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join('\n');
    if (pageText && pageText.trim().length > 0) {
      const lines = pageText.split('\n');
      lines.forEach(line => {
        // 保留原始行内容，包括空白
        if (line.trim().length > 0) {
          blocks.push({ type: 'p', text: line });
        }
      });
    }
  }
  return blocks;
}

async function processExcel(arrayBuffer) {
  const XLSX = await import('https://esm.sh/xlsx@0.18.5');
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const blocks = [];
  workbook.SheetNames.forEach((sheetName, idx) => {
    if (idx > 0) blocks.push({ type: 'h2', text: sheetName });
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    jsonData.forEach((row, rowIdx) => {
      if (rowIdx === 0 && idx === 0) {
        const headerText = row.filter(cell => cell !== null && cell !== undefined && cell !== '').join('  ');
        if (headerText && headerText.trim().length > 0) blocks.push({ type: 'h1', text: headerText });
      } else {
        const rowText = row.filter(cell => cell !== null && cell !== undefined && cell !== '').join('  ');
        if (rowText && rowText.trim().length > 0) blocks.push({ type: 'p', text: rowText });
      }
    });
  });
  return blocks;
}

btn.onclick = async () => {
  if (!currentFile) return;
  btn.disabled = true;
  setMsg('正在转换…');
  previewContainer.classList.remove('show');
  downloadBtn.style.display = 'none';
  fullscreenPreviewBtn.style.display = 'none';
  try {
    let blocks = [];
    if (currentFileType === 'docx') {
      blocks = await processDocx(currentFile);
    } else if (currentFileType === 'pdf') {
      blocks = await processPdf(currentFile);
    } else if (currentFileType === 'excel') {
      blocks = await processExcel(currentFile);
    } else {
      throw new Error('不支持的文件类型');
    }
    
    if (blocks.length === 0) throw new Error('未提取到内容，请确认文件含文字');
    
    // 自动识别标题和正文格式
    setMsg('正在自动识别标题格式…');
    try {
      // 使用本地智能识别
      blocks = identifyHeadingsLocal(blocks);
      setMsg('识别完成，正在转换…');
    } catch (error) {
      console.warn('识别失败，使用原始格式:', error);
      // 识别失败时也尝试本地识别
      blocks = identifyHeadingsLocal(blocks);
      setMsg('使用智能识别转换…');
    }
    
    // 保存当前的 blocks 数据
    currentBlocks = JSON.parse(JSON.stringify(blocks)); // 深拷贝
    
    // 显示原文预览
    originalText.textContent = extractTextFromBlocks(blocks);
    
    // 显示原文件格式信息
    originalFormat.innerHTML = generateFormatInfo(blocks, true);
    
    // 构建转换后的文档（第一个标题作为大标题）
    await buildAndPreviewDocument(blocks);
    
    // 显示预览
    previewContainer.classList.add('show');
    downloadBtn.style.display = 'block';
    fullscreenPreviewBtn.style.display = 'block';
    setMsg('转换完成，请查看预览并可直接修改标题格式（修改后自动更新）', 'ok');
  } catch (e) {
    setMsg('失败：' + (e.message || e), 'err');
  } finally {
    btn.disabled = false;
  }
};

// 构建并预览文档
async function buildAndPreviewDocument(blocks) {
  const { Document, Packer, out } = await buildParagraphs(blocks);
  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: GONGWEN.marginTop, right: GONGWEN.marginRight, bottom: GONGWEN.marginBottom, left: GONGWEN.marginLeft } } },
      children: out,
    }],
  });
  convertedBlob = await Packer.toBlob(doc);
  convertedFileName = currentName.replace(/\.(docx?|pdf|xlsx?)$/i, '') + '_公文格式.docx';
  
  // 显示转换后预览（可编辑的格式）
  renderEditablePreview(blocks);
  
  // 显示转换后格式信息
  convertedFormat.innerHTML = generateFormatInfo(blocks, false);
}

// 自动应用更改的函数（全局函数）
async function applyChangesAutomatically() {
  if (isUpdating) return; // 防止重复更新
  isUpdating = true;
  
  try {
    // 获取所有编辑后的标题（从预览区域）
    const previewItems = convertedText.querySelectorAll('.preview-item');
    const updatedBlocks = JSON.parse(JSON.stringify(currentBlocks)); // 深拷贝
    
    previewItems.forEach(item => {
      const typeSelect = item.querySelector('.preview-item-type select') || item.querySelector('.preview-item-type');
      const contentInput = item.querySelector('.preview-item-content input') || item.querySelector('.preview-item-content');
      const index = parseInt(item.dataset.index);
      
      if (index >= 0 && index < updatedBlocks.length && typeSelect && contentInput) {
        updatedBlocks[index].type = typeSelect.value;
        updatedBlocks[index].text = contentInput.value;
      }
    });
    
    // 重新构建文档
    await buildAndPreviewDocument(updatedBlocks);
    
    // 更新当前 blocks
    currentBlocks = updatedBlocks;
    
    // 重置更改标记
    previewItems.forEach(item => {
      item.style.background = '';
    });
  } catch (error) {
    console.error('自动应用更改失败:', error);
  } finally {
    isUpdating = false;
  }
}

// 在预览区域渲染可编辑的标题列表
function renderEditablePreview(blocks) {
  // 先使用 autoRenumber 重新编号所有标题
  const renumberedBlocks = autoRenumber(blocks);
  
  convertedText.innerHTML = '';
  
  renumberedBlocks.forEach((block, index) => {
    // h4会被autoRenumber映射为h3，所以这里不需要检查h4
    if (['h1', 'h2', 'h3', 'p', 'title'].includes(block.type)) {
      const item = document.createElement('div');
      item.className = 'preview-item';
      item.dataset.index = index;
      
      // 类型标签
      const label = document.createElement('div');
      label.className = 'preview-item-label';
      label.textContent = getTypeLabel(block.type);
      
      // 类型选择下拉框容器
      const typeSelectContainer = document.createElement('div');
      typeSelectContainer.className = 'preview-item-type';
      
      // 类型选择下拉框
      const typeSelect = document.createElement('select');
      
      // 先添加所有选项（大标题放在最后，不包含四级标题）
      ['p', 'h1', 'h2', 'h3', 'title'].forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type === 'p' ? '正文' : 
                            type === 'h1' ? '一级标题' : 
                            type === 'h2' ? '二级标题' : 
                            type === 'h3' ? '三级标题' : 
                            '大标题';
        typeSelect.appendChild(option);
      });
      
      // 设置默认值为系统识别的类型（确保选项已添加后再设置）
      const detectedType = block.type || 'p';
      // 如果识别为四级标题，映射为三级标题
      const mappedType = detectedType === 'h4' ? 'h3' : detectedType;
      // 确保类型在有效范围内
      if (['p', 'h1', 'h2', 'h3', 'title'].includes(mappedType)) {
        typeSelect.value = mappedType;
      } else {
        // 如果识别的类型不在选项中，默认为正文
        typeSelect.value = 'p';
      }
      
      typeSelect.addEventListener('change', async () => {
        label.textContent = getTypeLabel(typeSelect.value);
        
        // 构建当前所有blocks的状态
        const updatedBlocks = [];
        const allPreviewItems = convertedText.querySelectorAll('.preview-item');
        
        // 收集所有预览项的数据（去除序号前缀，只保留纯文本）
        allPreviewItems.forEach(prevItem => {
          const prevIndex = parseInt(prevItem.dataset.index);
          // 使用正确的选择器：.preview-item-type 是 select 的父容器，select 是直接子元素
          const prevTypeSelect = prevItem.querySelector('.preview-item-type select') || prevItem.querySelector('.preview-item-type');
          const prevContentInput = prevItem.querySelector('.preview-item-content input') || prevItem.querySelector('.preview-item-content');
          
          if (prevIndex >= 0 && prevTypeSelect && prevContentInput) {
            // 获取当前类型（如果是当前项，使用新选择的值）
            const currentType = prevIndex === index ? typeSelect.value : prevTypeSelect.value;
            
            // 获取文本内容（去除序号前缀）
            let textValue = prevContentInput.value;
            // 去除所有可能的序号格式
            textValue = textValue.replace(/^([一二三四五六七八九十]+)[、．.]\s*/, '');
            textValue = textValue.replace(/^[（(]([一二三四五六七八九十]+)[）)]\s*/, '');
            textValue = textValue.replace(/^(\d+)[、．.]\s*/, '');
            textValue = textValue.replace(/^(\d+)[、．]\s*/, '');
            textValue = textValue.replace(/^[（(](\d+)[）)]\s*/, '');
            textValue = textValue.replace(/^\((\d+)\)\s*/, '');
            textValue = textValue.trim();
            
            updatedBlocks.push({
              type: currentType,
              text: textValue
            });
          }
        });
        
        // 如果 updatedBlocks 长度不够，补充缺失的项
        while (updatedBlocks.length < currentBlocks.length) {
          const missingIndex = updatedBlocks.length;
          if (missingIndex < currentBlocks.length) {
            updatedBlocks.push({ ...currentBlocks[missingIndex] });
          } else {
            updatedBlocks.push({ type: 'p', text: '' });
          }
        }
        
        // 使用 autoRenumber 重新编号所有标题
        currentBlocks = autoRenumber(updatedBlocks);
        
        // 重新渲染所有预览项（会自动显示新的序号）
        renderEditablePreview(currentBlocks);
        
        // 自动应用更改
        await applyChangesAutomatically();
      });
      
      // 内容输入框
      const contentInput = document.createElement('input');
      contentInput.type = 'text';
      contentInput.className = 'preview-item-content';
      
      // 获取序号前缀（block 应该已经通过 autoRenumber 处理，包含 number 属性）
      const numberPrefix = getNumberPrefix(block);
      
      // 提取纯文本内容（去除所有可能存在的旧序号格式）
      let displayText = block.text || '';
      
      // 如果有序号前缀，先检查文本是否已经以该前缀开头
      if (numberPrefix && displayText.startsWith(numberPrefix)) {
        // 如果已经以正确的前缀开头，直接使用
        displayText = displayText.substring(numberPrefix.length).trim();
      } else {
        // 去除所有可能的旧序号格式（确保完全去除）
        displayText = displayText.replace(/^([一二三四五六七八九十]+)[、．.]\s*/, '');
        displayText = displayText.replace(/^[（(]([一二三四五六七八九十]+)[）)]\s*/, '');
        displayText = displayText.replace(/^(\d+)[、．.]\s*/, '');
        displayText = displayText.replace(/^(\d+)[、．]\s*/, '');
        displayText = displayText.replace(/^[（(](\d+)[）)]\s*/, '');
        displayText = displayText.replace(/^\((\d+)\)\s*/, '');
        displayText = displayText.trim();
      }
      
      // 如果有序号前缀，显示序号+文本；否则只显示文本
      contentInput.value = numberPrefix + displayText;
      contentInput.dataset.index = index;
      
      // 使用防抖，避免频繁更新
      let inputTimeout = null;
      contentInput.addEventListener('input', () => {
        // 标记已更改
        item.style.background = '#fff9e6';
        
        // 清除之前的定时器
        if (inputTimeout) {
          clearTimeout(inputTimeout);
        }
        
        // 延迟500ms后自动应用更改（防抖）
        inputTimeout = setTimeout(async () => {
          await applyChangesAutomatically();
        }, 500);
      });
      
      typeSelectContainer.appendChild(typeSelect);
      
      item.appendChild(label);
      item.appendChild(typeSelectContainer);
      item.appendChild(contentInput);
      convertedText.appendChild(item);
    }
  });
}

function getTypeLabel(type) {
  const labels = {
    'p': '正文',
    'h1': '一级标题',
    'h2': '二级标题',
    'h3': '三级标题',
    'h4': '四级标题',
    'title': '大标题'
  };
  return labels[type] || '未知';
}

// 自动重新编号所有标题
function autoRenumber(blocks) {
  let counters = { 1: 0, 2: 0, 3: 0 };

  return blocks.map(block => {
    // h4映射到h3
    let blockType = block.type;
    if (blockType === 'h4') {
      blockType = 'h3';
    }
    
    if (!['h1','h2','h3'].includes(blockType)) {
      return block;
    }

    const level = parseInt(blockType.replace('h',''));

    // 当前级别 +1
    counters[level]++;

    // 清空下级计数
    for (let i = level + 1; i <= 3; i++) {
      counters[i] = 0;
    }

    return {
      ...block,
      type: blockType, // 确保h4被映射为h3
      number: counters[level]
    };
  });
}

// 根据标题类型和编号生成序号前缀
function getNumberPrefix(block) {
  if (!block.number) return '';

  // h4映射到h3
  const blockType = block.type === 'h4' ? 'h3' : block.type;

  if (blockType === 'h1') {
    const chinese = ['一','二','三','四','五','六','七','八','九','十'];
    if (block.number >= 1 && block.number <= 10) {
      return chinese[block.number - 1] + '、';
    }
    return block.number + '、';
  }

  if (blockType === 'h2') {
    const chinese = ['一','二','三','四','五','六','七','八','九','十'];
    if (block.number >= 1 && block.number <= 10) {
      return '（' + chinese[block.number - 1] + '）';
    }
    return '（' + block.number + '）';
  }

  if (blockType === 'h3') {
    return block.number + '. ';
  }

  return '';
}

// 转换序号格式
function convertNumbering(text, targetType) {
  if (!text) return text;
  
  // 中文数字映射
  const chineseNumbers = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  const chineseToNumber = {
    '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
    '六': 6, '七': 7, '八': 8, '九': 9, '十': 10
  };
  
  // 提取当前序号
  let currentNumber = null;
  let restText = text;
  
  // 检测并提取各种序号格式
  // 1. 中文数字 "一、" "二、"
  const match1 = text.match(/^([一二三四五六七八九十]+)[、．.]/);
  if (match1) {
    currentNumber = chineseToNumber[match1[1]] || null;
    restText = text.substring(match1[0].length).trim();
  }
  
  // 2. 带括号的中文数字 "（一）" "（二）"
  const match2 = text.match(/^[（(]([一二三四五六七八九十]+)[）)]/);
  if (match2) {
    currentNumber = chineseToNumber[match2[1]] || null;
    restText = text.substring(match2[0].length).trim();
  }
  
  // 3. 阿拉伯数字 "1." "2."
  const match3 = text.match(/^(\d+)[、．.]/);
  if (match3) {
    currentNumber = parseInt(match3[1]);
    restText = text.substring(match3[0].length).trim();
  }
  
  // 4. 带括号的阿拉伯数字 "(1)" "(2)"
  const match4 = text.match(/^[（(](\d+)[）)]/);
  if (match4) {
    currentNumber = parseInt(match4[1]);
    restText = text.substring(match4[0].length).trim();
  }
  
  // 如果没有检测到序号，尝试从文本中提取数字
  if (currentNumber === null) {
    const numberMatch = text.match(/^(\d+)/);
    if (numberMatch) {
      currentNumber = parseInt(numberMatch[1]);
      restText = text.substring(numberMatch[0].length).trim();
    }
  }
  
  // 根据目标类型转换序号格式
  if (targetType === 'title') {
    // 大标题：移除序号（大标题通常不需要序号）
    return restText || text;
  } else if (targetType === 'h1') {
    // 一级标题：使用"一、"格式
    if (currentNumber !== null && currentNumber >= 1 && currentNumber <= 10) {
      return chineseNumbers[currentNumber - 1] + '、' + restText;
    } else if (currentNumber !== null) {
      return currentNumber + '、' + restText;
    }
    return text; // 如果没有序号，保持原样
  } else if (targetType === 'h2') {
    // 二级标题：使用"（一）"格式
    if (currentNumber !== null && currentNumber >= 1 && currentNumber <= 10) {
      return '（' + chineseNumbers[currentNumber - 1] + '）' + restText;
    } else if (currentNumber !== null) {
      return '（' + currentNumber + '）' + restText;
    }
    return text; // 如果没有序号，保持原样
  } else if (targetType === 'h3') {
    // 三级标题：使用"1."格式
    if (currentNumber !== null) {
      return currentNumber + '. ' + restText;
    }
    return text; // 如果没有序号，保持原样
  } else if (targetType === 'p') {
    // 正文：保留序号（不进行转换）
    return text;
  }
  
  // 其他类型保持原样
  return text;
}

downloadBtn.onclick = async () => {
  if (!convertedBlob) return;
  
  // 在下载前，确保应用所有最新的更改
  try {
    const previewItems = convertedText.querySelectorAll('.preview-item');
    if (previewItems.length > 0) {
      const updatedBlocks = JSON.parse(JSON.stringify(currentBlocks)); // 深拷贝
      
      previewItems.forEach(item => {
        const typeSelect = item.querySelector('.preview-item-type select') || item.querySelector('.preview-item-type');
        const contentInput = item.querySelector('.preview-item-content input') || item.querySelector('.preview-item-content');
        const index = parseInt(item.dataset.index);
        
        if (index >= 0 && index < updatedBlocks.length && typeSelect && contentInput) {
          updatedBlocks[index].type = typeSelect.value;
          updatedBlocks[index].text = contentInput.value;
        }
      });
      
      // 重新构建文档（确保下载的是最新版本）
      await buildAndPreviewDocument(updatedBlocks);
      currentBlocks = updatedBlocks;
    }
  } catch (error) {
    console.error('更新文档失败:', error);
  }
  
  // 下载文档
  const a = document.createElement('a');
  a.href = URL.createObjectURL(convertedBlob);
  a.download = convertedFileName;
  a.click();
  URL.revokeObjectURL(a.href);
  setMsg('已下载：' + convertedFileName, 'ok');
};

// 全屏预览功能
fullscreenPreviewBtn.onclick = async () => {
  if (!convertedBlob) return;
  
  setMsg('正在准备全屏预览…');
  
  // 在预览前，确保应用所有最新的更改
  try {
    const previewItems = convertedText.querySelectorAll('.preview-item');
    if (previewItems.length > 0) {
      const updatedBlocks = JSON.parse(JSON.stringify(currentBlocks)); // 深拷贝
      
      previewItems.forEach(item => {
        const typeSelect = item.querySelector('.preview-item-type select') || item.querySelector('.preview-item-type');
        const contentInput = item.querySelector('.preview-item-content input') || item.querySelector('.preview-item-content');
        const index = parseInt(item.dataset.index);
        
        if (index >= 0 && index < updatedBlocks.length && typeSelect && contentInput) {
          updatedBlocks[index].type = typeSelect.value;
          updatedBlocks[index].text = contentInput.value;
        }
      });
      
      // 重新构建文档（确保预览的是最新版本）
      const { Document, Packer, out } = await buildParagraphs(updatedBlocks);
      const doc = new Document({
        sections: [{
          properties: { page: { margin: { top: GONGWEN.marginTop, right: GONGWEN.marginRight, bottom: GONGWEN.marginBottom, left: GONGWEN.marginLeft } } },
          children: out,
        }],
      });
      convertedBlob = await Packer.toBlob(doc);
      currentBlocks = updatedBlocks;
    }
  } catch (error) {
    console.error('更新文档失败:', error);
    setMsg('更新文档失败，使用当前版本预览', 'err');
  }
  
  // 显示全屏模态框
  fullscreenModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  
  // 清空之前的预览内容
  fullscreenPreviewContainer.innerHTML = '';
  
  // 显示加载提示
  const fullscreenLoading = document.getElementById('fullscreenLoading');
  fullscreenLoading.style.display = 'block';
  
  try {
    // 获取最新的blocks数据
    let previewBlocks = JSON.parse(JSON.stringify(currentBlocks));
    
    // 从预览区域获取最新的编辑内容
    const previewItems = convertedText.querySelectorAll('.preview-item');
    if (previewItems.length > 0) {
      previewItems.forEach(item => {
        const typeSelect = item.querySelector('.preview-item-type select');
        const contentInput = item.querySelector('.preview-item-content input');
        const index = parseInt(item.dataset.index);
        
        if (index >= 0 && index < previewBlocks.length && typeSelect && contentInput) {
          previewBlocks[index].type = typeSelect.value;
          previewBlocks[index].text = contentInput.value;
        }
      });
    }
    
    // 生成格式化的HTML预览
    function renderFormattedPreview(blocks) {
      const html = [];
      
      // 添加页面样式
      html.push('<style>');
      html.push('.preview-doc {');
      html.push('  max-width: 800px;');
      html.push('  margin: 0 auto;');
      html.push('  padding: 37px 28px 35px 28px;');
      html.push('  background: #fff;');
      html.push('  box-shadow: 0 0 10px rgba(0,0,0,0.1);');
      html.push('  min-height: 100vh;');
      html.push('}');
      html.push('.preview-title {');
      html.push(`  font-family: "${GONGWEN.fontTitle}", "SimSun", serif;`);
      html.push('  font-size: 22pt;');
      html.push('  line-height: 30pt;');
      html.push('  text-align: center;');
      html.push('  margin: 0;');
      html.push('  padding: 0;');
      html.push('}');
      html.push('.preview-h1 {');
      html.push(`  font-family: "${GONGWEN.fontH1}", "SimHei", sans-serif;`);
      html.push('  font-size: 16pt;');
      html.push('  line-height: 28pt;');
      html.push('  font-weight: bold;');
      html.push('  text-align: left;');
      html.push('  margin: 0;');
      html.push('  padding: 0;');
      html.push('  text-indent: 2em;');
      html.push('}');
      html.push('.preview-h2 {');
      html.push(`  font-family: "${GONGWEN.fontH2}", "KaiTi", serif;`);
      html.push('  font-size: 16pt;');
      html.push('  line-height: 28pt;');
      html.push('  text-align: left;');
      html.push('  margin: 0;');
      html.push('  padding: 0;');
      html.push('  text-indent: 2em;');
      html.push('}');
      html.push('.preview-h3 {');
      html.push(`  font-family: "${GONGWEN.fontH3}", "SimSun", serif;`);
      html.push('  font-size: 16pt;');
      html.push('  line-height: 28pt;');
      html.push('  font-weight: bold;');
      html.push('  text-align: left;');
      html.push('  margin: 0;');
      html.push('  padding: 0;');
      html.push('  text-indent: 2em;');
      html.push('}');
      html.push('.preview-body {');
      html.push(`  font-family: "${GONGWEN.fontBody}", "FangSong", serif;`);
      html.push('  font-size: 16pt;');
      html.push('  line-height: 28pt;');
      html.push('  text-align: left;');
      html.push('  margin: 0;');
      html.push('  padding: 0;');
      html.push('  text-indent: 2em;');
      html.push('}');
      html.push('.preview-number {');
      html.push(`  font-family: "${GONGWEN.fontNumber}", serif;`);
      html.push('}');
      html.push('.preview-blank {');
      html.push('  height: 30pt;');
      html.push('  margin: 0;');
      html.push('  padding: 0;');
      html.push('}');
      html.push('</style>');
      
      html.push('<div class="preview-doc">');
      
      let firstTitleFound = false;
      
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        const text = b.text || '';
        
        if (!text || text.trim().length === 0) continue;
        
        // 处理数字，将阿拉伯数字用span包裹以应用Times New Roman字体
        function processNumbers(text) {
          return text.replace(/(\d+(?:\.\d+)?(?:%|‰)?)/g, '<span class="preview-number">$1</span>');
        }
        
        // 大标题
        if (b.type === 'title') {
          html.push(`<p class="preview-title">${processNumbers(text)}</p>`);
          html.push('<p class="preview-blank"></p>'); // 大标题下空一行
          firstTitleFound = true;
          continue;
        }
        
        // 如果还没有找到大标题，第一个非空块作为大标题
        if (!firstTitleFound) {
          html.push(`<p class="preview-title">${processNumbers(text)}</p>`);
          html.push('<p class="preview-blank"></p>'); // 大标题下空一行
          firstTitleFound = true;
          continue;
        }
        
        // 一级标题
        if (b.type === 'h1') {
          html.push(`<p class="preview-h1">${processNumbers(text)}</p>`);
          continue;
        }
        
        // 二级标题
        if (b.type === 'h2') {
          html.push(`<p class="preview-h2">${processNumbers(text)}</p>`);
          continue;
        }
        
        // 三级标题
        if (b.type === 'h3') {
          html.push(`<p class="preview-h3">${processNumbers(text)}</p>`);
          continue;
        }
        
        // 图片
        if (b.type === 'image' && b.src) {
          html.push(`<p style="text-align: center; margin: 10pt 0;"><img src="${b.src}" style="max-width: 100%; height: auto;" /></p>`);
          continue;
        }
        
        // 正文
        html.push(`<p class="preview-body">${processNumbers(text)}</p>`);
      }
      
      html.push('</div>');
      return html.join('');
    }
    
    // 渲染格式化预览
    fullscreenPreviewContainer.innerHTML = renderFormattedPreview(previewBlocks);
    
    // 隐藏加载提示
    fullscreenLoading.style.display = 'none';
    setMsg('全屏预览已打开', 'ok');
    
  } catch (error) {
    console.error('预览加载失败:', error);
    fullscreenLoading.style.display = 'none';
    fullscreenPreviewContainer.innerHTML = `
      <div style="padding: 40px; text-align: center; color: #c00;">
        <h3>预览加载失败</h3>
        <p style="margin: 20px 0;">${error.message || '未知错误'}</p>
        <p style="color: #666; margin-top: 20px;">请尝试刷新页面后重试</p>
      </div>
    `;
    setMsg('预览加载失败', 'err');
  }
};

// 关闭全屏预览
function closeFullscreenPreview() {
  fullscreenModal.style.display = 'none';
  fullscreenPreviewContainer.innerHTML = '';
  document.body.style.overflow = '';
}

closeFullscreenBtn.onclick = closeFullscreenPreview;

// 按ESC键关闭全屏预览
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && fullscreenModal.style.display === 'flex') {
    closeFullscreenPreview();
  }
});

// 点击模态框背景关闭
fullscreenModal.addEventListener('click', (e) => {
  if (e.target === fullscreenModal) {
    closeFullscreenPreview();
  }
});
