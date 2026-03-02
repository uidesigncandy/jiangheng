# 公文格式自动转换

将 Word、PDF 或 Excel 文档一键转换为 **GB/T 9704-2012《党政机关公文格式》** 规范格式的网页工具。

## 登录配置（Supabase）

本站使用 [Supabase](https://supabase.com) 做登录校验，使用前需完成以下步骤：

1. **注册并创建项目**  
   打开 [Supabase](https://supabase.com) → 注册/登录 → New Project，创建完成后进入项目。

2. **填写前端配置**  
   在项目中打开 **Project Settings → API**，复制：
   - **Project URL** → 粘贴到 `js/supabase-config.js` 的 `SUPABASE_URL`
   - **anon public** key → 粘贴到 `js/supabase-config.js` 的 `SUPABASE_ANON_KEY`

3. **创建登录用户**  
   在 Supabase 控制台：**Authentication → Users → Add user**，选择 “Create new user”，填写邮箱和密码。  
   之后即可用该邮箱和密码在登录页登录。

4. **（可选）关闭公开注册**  
   若只允许你创建的用户登录：**Authentication → Providers → Email** 中关闭 “Enable Sign Up”，仅保留 “Enable Sign In”。

---

## 格式说明

### 页面设置
- **纸张**：A4
- **页边距**：上 3.7cm，下 2.8cm，左 2.8cm，右 2.8cm

### 标题格式

#### 大标题
- **位置**：文档第一个标题
- **字体**：方正小标宋简体
- **字号**：二号（22磅）
- **行距**：固定值 30 磅
- **对齐**：居中
- **缩进**：无缩进
- **特殊**：大标题下空一行

#### 一级标题
- **字体**：黑体
- **字号**：三号（16磅）
- **样式**：加粗
- **行距**：固定值 28 磅
- **对齐**：左对齐
- **缩进**：首行缩进 2 个字符
- **编号格式**：一、二、三、...

#### 二级标题
- **字体**：楷体_GB2312
- **字号**：三号（16磅）
- **行距**：固定值 28 磅
- **对齐**：左对齐
- **缩进**：首行缩进 2 个字符
- **编号格式**：（一）（二）（三）...

#### 三级标题
- **字体**：宋_GB2312
- **字号**：三号（16磅）
- **样式**：加粗
- **行距**：固定值 28 磅
- **对齐**：左对齐
- **缩进**：首行缩进 2 个字符
- **编号格式**：1. 2. 3. ...

### 正文格式
- **字体**：仿宋_GB2312
- **字号**：三号（16磅）
- **行距**：固定值 28 磅
- **对齐**：左对齐
- **缩进**：首行缩进 2 个字符

### 图片格式
- **行距**：单倍行距（1倍行距）

### 特殊格式
- **阿拉伯数字**：全文阿拉伯数字使用 Times New Roman 字体
- **序号保留**：文档中的序号在转换后会完整保留


## 支持的文件格式

- **Word 文档**：`.docx`
- **PDF 文档**：`.pdf`
- **Excel 表格**：`.xlsx`、`.xls`

## 使用步骤

1. 安装依赖：`npm install`
2. 启动开发服务器：`npm run dev`
3. 在浏览器中打开页面，上传 Word、PDF 或 Excel 文件
4. 点击「转换为公文格式并下载」得到新文档

**或直接使用 HTML 文件**：
- 打开「终端」，输入：`python3 -m http.server 8080`
- 然后浏览器访问：`http://localhost:8080/公文格式转换.html`

## 构建与预览

- 构建：`npm run build`（输出在 `dist/`）
- 预览构建结果：`npm run preview`

## 部署和发布

本项目为**纯前端静态页面**（依赖通过 esm.sh CDN 加载），无需构建即可部署。

### 部署前注意

- 必须通过 **HTTP/HTTPS** 访问页面（不能直接用 `file://` 打开），否则浏览器会拦截 ES 模块请求。
- 部署后需能访问外网（esm.sh），否则 docx、mammoth、pdf.js、xlsx 等无法加载。
- **防止别人保存后使用**：公文格式转换页的核心脚本 `js/convert-main.js` 会校验当前是否在「允许的域名」下打开；若别人把整站另存为到本地（`file://`）或部署到其他域名，打开后只会看到「请通过正式站点使用」，功能不会执行。  
  若你部署到自己的域名（如 Vercel、自有服务器），需在 `js/convert-main.js` 文件最上方的 `allowed` 数组里增加你的域名（如 `'https://你的域名.com'`），否则在自己站点上也会被拦截。

### 方式一：GitHub Pages

**1. 在 GitHub 上新建仓库**

- 打开 [github.com/new](https://github.com/new)
- 仓库名自定（如 `gongwen-convert`），选 Public，**不要**勾选 “Add a README”
- 点击 **Create repository**

**2. 在本地用 Git 推送项目**

在终端中进入本项目目录，执行：

```bash
cd /Users/tangjinwen/Desktop/公文格式转换

git init
git add .
git commit -m "Initial commit: 公文格式转换"
git branch -M main
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

将 `<你的用户名>` 和 `<仓库名>` 换成你的 GitHub 用户名和刚建的仓库名。

**本仓库（jiangheng）推送示例（SSH）：**

- 仓库地址：`git@github.com:uidesigncandy/jiangheng.git`
- 首次推送：`git remote add origin git@github.com:uidesigncandy/jiangheng.git` → `git branch -M main` → `git push -u origin main`
- 若已存在 origin：`git remote set-url origin git@github.com:uidesigncandy/jiangheng.git` → `git push -u origin main`

**3. 开启 GitHub Pages**

- 打开该仓库 → **Settings** → 左侧 **Pages**
- **Source** 选 **Deploy from a branch**
- **Branch** 选 `main`，**Folder** 选 **/ (root)**，点 **Save**

**4. 访问页面**

等 1～2 分钟后访问：

- 主页面：`https://<你的用户名>.github.io/<仓库名>/`（若已添加 `index.html` 会直接打开工具）
- 或直接：`https://<你的用户名>.github.io/<仓库名>/公文格式转换.html`

### 方式二：Vercel / Netlify

1. 将项目上传到 GitHub（或直接导入本地文件夹）。
2. 在 [Vercel](https://vercel.com) 或 [Netlify](https://netlify.com) 新建项目，选择该仓库或文件夹。
3. 构建命令留空，发布目录选项目根目录（或包含 HTML 的目录）。
4. 部署完成后，访问分配给的域名，例如：`https://你的项目.vercel.app/公文格式转换.html`。

### 方式三：自有服务器（Nginx / Apache）

- 把整个项目目录拷到服务器，配置静态站点指向该目录。
- 确保默认首页或链接指向 `公文格式转换.html`，或通过 `https://你的域名/公文格式转换.html` 访问。

### 方式四：本地或内网快速发布

在项目目录下执行：

```bash
# Python 3
python3 -m http.server 8080
```

浏览器访问：`http://localhost:8080/公文格式转换.html`。同一局域网内其他设备可用 `http://你的电脑IP:8080/公文格式转换.html` 访问。

---

## 技术栈

- [mammoth](https://github.com/mwilliamson/mammoth.js)：从 .docx 提取内容
- [pdf.js](https://mozilla.github.io/pdf.js/)：从 PDF 提取文本内容
- [xlsx](https://github.com/SheetJS/sheetjs)：从 Excel 读取数据
- [docx](https://docx.js.org/)：按公文格式生成 .docx
