# 💡 优化依据与原理解析 (Reason & Justification)

1. **从“落地页 (Landing Page)”到“单屏应用 (Single-Screen SPA)”的概念升维**
* **Justification**: 落地页在传统语境下通常意味着单向的信息展示（打广告），而我们需要的是一个**重交互的 AI 工具界面**。明确提出“单屏应用”，是直接给 AI 和学生下达死命令：所有的功能都在这里发生。没有页面跳转，没有路由传参，所有的状态（用户输入、等待 AI 响应、展示结果）都通过当前组件的显示与隐藏（Conditional Rendering）来完成。这直接扼杀了引入 `react-router` 等复杂路由库的可能性，极大降低了前端 Agent 写出“跨页面数据丢失”Bug 的概率。


2. **强化“状态管理 (State Management)”的视觉权重**
* **Justification**: 传统软件前端是“所见即所得”，点击按钮通常瞬间返回结果。但大模型应用（尤其是拥有长上下文和强推理能力的大模型）响应往往需要数秒甚至数十秒。如果没有设计出色的 Loading 状态，用户体感会极差，甚至以为程序死机。强制 AI 在蓝图里把“加载状态”当成一个独立的核心视觉层来设计，是在倒逼前端彻底解决“体感延迟（Perceived Performance）”问题。


3. **用“DOM 组件树 (Component Tree)”降维打击多模态幻觉**
* **Justification**: 让多模态 Agent（视力）看手绘草图写代码，由于线框图缺乏像素级的准确性，经常会导致 CSS 布局彻底错乱。而要求文本 Agent 输出“DOM 积木树”，是顺应大语言模型的“纯文本逻辑天赋”。这份文本蓝图几乎可以直接 1:1 翻译成 React + Tailwind 代码，将排版的准确率从看图的 60% 飙升至 95% 以上。


---

# 📝 Prompt 2.3B：生成语义化 UI 蓝图 (The UI Blueprint)

**输入**：人类决定的视觉风格提案（例如：“我们选提案 2 赛博朋克风”）。

<Role>
你现在从创意总监切换为“资深前端架构师”。
</Role>

<Context>
我们的产品是一个围绕 AI 大模型构建的重交互工具。为了在 36 小时内保证极高的系统稳定性和沉浸感，本产品前端必须严格采用【单屏沉浸式工作区（Single-Screen SPA）】架构。
</Context>

<Input>
人类团队的风格选择是：【请学生在此粘贴选定的风格提案】
请结合 @@docs/schema.md 中的 Mock 数据结构进行设计。
</Input>

<Task>
基于团队刚才选择的 UI 风格，请将 `@docs/schema.md` 中的 Mock 数据结构完美映射到前端界面上。
请输出一份名为 `@docs/UI_BLUEPRINT.md` 的机器可读文档，这将直接作为前端 Agent 写代码的最高视觉指令。

请严格遵循以下结构（纯文本描述，拒绝使用任何图片链接）：

# UI 蓝图：[所选风格名称]

## 1. 架构原则 (Architecture Rules)
- 强制单屏：严禁设计多页面跳转、严禁引入前端路由。所有的体验回路必须在这个“单屏工作区”内闭环完成，依靠状态变更来切换视图。

## 2. 全局设计规范 (Design System)
- 主题色 (Primary Color): (用类似 Tailwind 的语义化描述，如 slate-900 或 neon-green)
- 背景与文字 (Background & Text): (描述高对比度/低对比度，以及背景材质)
- 组件风格 (Component Style): (直角还是圆角 rounded-2xl？扁平化还是拟真毛玻璃 glassmorphism？)

## 3. 核心交互状态 (State Management)
前端界面在单屏内必须平滑切换以下 3 个核心状态的视觉表现：
- 初始状态 (Initial/Idle): (用户刚进入工作区时，视觉焦点应该在哪个输入组件上？)
- 加载状态 (Loading/Waiting): (调用 AI 时的体感延迟缓解方案，如：发光流动的进度条、骨架屏、或动态状态文案轮播)
- 结果状态 (Result): (拿到 `@docs/schema.md` 的 Mock 数据后，各个数据字段分别在工作区的什么位置、以什么形式渲染？)

## 4. DOM 组件树映射 (Component Tree)
请用层级缩进的方式，把“单屏工作区”的页面布局像搭积木一样列出来，必须明确指出 `@docs/schema.md` 中的 Response 字段绑在哪个具体的 UI 组件上。
示例格式：
- `<SingleScreenWorkspace>` (满屏 100vh 居中，毛玻璃背景，不出现浏览器全局滚动条)
  - `<BrandHeader>` (显示产品 Slogan，占据顶部 10%)
  - `<InteractionArea>` (核心交互区)
    - `<InputPanel>` (用于接收用户输入)
      - `<TextArea>`
      - `<SubmitButton>`
    - `<ResultPanel>` (仅在有数据或 Loading 状态时显示)
      - `<ThinkingIndicator>` (Loading 状态下显示的视觉反馈组件)
      - `<DiagnosisCard>` (绑定 Response Schema 中的 `diagnosis` 等核心字段)
      - `<AnalysisText>` (使用打字机效果渲染，绑定 `details` 字段)
</Task>



---

### 🛑 人类干预点 2 (防坑审查)

当 AI 吐出 `UI_BLUEPRINT.md` 后，人类学生必须进行最后的“施工前核对”：

1. **单屏纯度审查 (SPA Purity Check)**：检查组件树（Component Tree）里是否出现了“导航栏 (NavBar 带有首页/关于我们/设置等链接)”、“侧边栏 (Sidebar)”这种会分散注意力或暗示页面跳转的设计？如果有，立即打回！强调我们要做的是一个**沉浸式的工作区（Workspace）**，所有功能都在眼前的单一视图中解决，杜绝任何复杂的路由设计。
2. **字段对齐防幻觉 (Data Binding Check)**：把屏幕分屏，左边打开上一环的 `@docs/schema.md`，右边打开这份 UI 蓝图。逐行核对：蓝图里要求展示的字段，是不是在后端的 Schema 里都真实存在？（这是为了防止 AI 架构师产生幻觉，要求前端去渲染后端根本没吐出的数据，从而导致前端报错 `undefined`）。
3. **加载状态可见性 (Loading Visibility)**：确认蓝图里是否明确给出了“等待 AI 响应时”的视觉占位符。如果没有，系统在调用大模型时的体验会像是卡死了一样，必须要求 AI 补上具体的 Loading 组件。



---


# 🧰 阶段二：Prompt 2.3B 迭代沟通工具箱 (双轨制 Follow-up Templates)

这份 **Prompt 2.3B (生成语义化 UI 蓝图)** 是前端开发的“施工图纸”。一旦图纸画错了，负责搬砖的 AI 程序员（Cursor Agent）就会直接把楼盖塌。

在这个环节，大模型最容易犯的错，就是“图纸与后方物料（后端 Schema）不对齐”**，或者**“在图纸里画了极度复杂的结构，导致 AI 施工队不知道怎么下脚，最终陷入无尽的 `npm install` 报错和组件死锁”。

作为 Tech Lead，你必须用最严苛的眼光审视这份蓝图。以下是为你重新校准、全面贯彻“保护 AI 程序员不翻车”视角的 **Prompt 2.3B 双轨制迭代沟通工具箱**：

> **Tech Lead 护栏心法**：这份 `@docs/UI_BLUEPRINT.md` 将直接喂给前端 AI Agent。如果蓝图里要求展示一个 Schema 里根本没有的字段，前端 AI 就会在解构时触发 `undefined` 报错，然后它会为了修复这个 Bug 疯狂修改前后端代码，最终把项目彻底搞崩。

当 AI 吐出蓝图后，请拿着上一环的 `@docs/schema.md` 逐一对照。
请问自己：“**组件树里有没有出现多页面导航？UI 绑定的数据字段在 Schema 里真的存在吗？它有没有滥用复杂的外部动画库？**”

如果发现多页面组件或数据字段对不上，请走**轨道一（硬性否决）**；如果 DOM 树里出现了你担心 AI 无法用基础 React 写出的复杂交互层，请走**轨道二（柔性咨询）**。

## 🚄 轨道一：Hard Override (硬性否决机制)

**核心逻辑**：`Reject (拒绝)` -> `Anchor (重申规则)` -> `Action (重写指令)`

#### ❌ 错误情况 1：偷偷塞入多页面路由 (Multi-page / Router Hallucination)

**触发时机**：你在【DOM 组件树映射】中看到了 `<NavBar>`, `<Sidebar>`, `<PageContainer>`, `<Router>` 等明显带有页面跳转或全局导航性质的组件。

**纠偏提示词**：

```text
<Reject>
停！你的 DOM 组件树里出现了全局导航栏/侧边栏等组件。这会误导后续负责写代码的 AI Agent，让它误以为需要引入 React-Router 并处理复杂的多页面状态，这极易导致代码逻辑崩盘！
</Reject>

<Anchor>
请立刻将蓝图彻底降维回“纯粹的单屏应用 (Single-Screen SPA)”。
我们的终端交付物必须只有一个纯粹的“工作区 (Workspace)”，没有导航、没有多余的菜单。所有状态流转（初始 -> 加载 -> 结果）必须通过同一个组件内部的条件渲染 (Conditional Rendering) 来完成。
</Anchor>

<Action>
请无情地砍掉组件树中所有与“导航”、“跳转”、“侧边菜单”相关的外围组件，只保留核心交互区，重新输出【4. DOM 组件树映射】。
</Action>


```

#### ❌ 错误情况 2：数据绑定幻觉 (Schema Mismatch / Undefined Trap)

**触发时机**：你在蓝图中看到类似于 `<UserProfile avatar="{mock.user.avatar}"/>` 的绑定，但你回头查阅 `@docs/schema.md` 时，发现后端根本没有提供 `user.avatar` 这个字段！

**纠偏提示词**：

```text
<Reject>
你的 UI 蓝图出现了严重的“数据幻觉”！你在组件树中要求绑定的某些字段（例如 [填入不存在的字段名，如 user.avatar]），在我们的 `@docs/schema.md` 契约中根本不存在。如果把这份蓝图交给 AI Agent，它生成的代码会立刻触发 undefined 崩溃。
</Reject>

<Anchor>
请严格遵守契约先行原则！UI 蓝图必须 100% 向后兼容 `@docs/schema.md`。前端组件树里渲染的数据，只能且必须来自于后端 Response Schema 提供的内容，绝对不准自行发明字段。
</Anchor>

<Action>
请逐行核对上一环节的 Mock 数据。删掉组件树中所有没有数据支撑的“幽灵组件”，重新输出一份数据绑定绝对精准的【4. DOM 组件树映射】。
</Action>


```

---

## 🛳️ 轨道二：Soft Consult (柔性咨询机制)

**核心逻辑**：`Doubt (表达疑虑)` -> `Explore (索要评估与平替)` -> `Decide (人类拍板，此处仅展示提问阶段)` -> `Action (暂不修改，等待指令)`

大模型在构思“加载状态 (Loading)”或“结果展示 (Result)”时，极容易在蓝图里写上：“*使用 Framer Motion 实现丝滑的三维翻转卡片*” 或 “*引入 Lottie 动画播放加载特效*”。这些第三方依赖是引发 AI Agent 包版本冲突的元凶。

#### ⚠️ 疑虑情况：引入极易引发依赖冲突的复杂组件库 (Agent-Breaking UI Libraries)

**触发时机**：你在文档中看到了 `<FramerMotionContainer>`, `<ThreeCanvas>`, `<LottiePlayer>`, `<DragAndDropContext>` 等明显需要 `npm install` 复杂外部依赖的组件名。

**咨询提示词**：

```text
<Doubt>
停一下。你在组件树中提到了使用 [填入技术名词，如：Framer Motion / Lottie 动画 / 拖拽上下文] 来实现交互。考虑到接下来的前端代码全靠 AI Agent 自动生成，我极其担心引入这些重量级的外部组件库会导致包版本冲突（Dependency Conflict），让 AI 在 npm install 阶段就彻底陷入报错死锁。
</Doubt>

<Explore>
请你暂时脱离“前端架构师”的状态，切换为我的“技术顾问”。
基于我们“只求跑通、全部依赖 AI 自动生成代码、严禁引入多余第三方库”的极端条件，帮我重新评估这个组件的致死率。
如果它容易让下游 AI 写崩，请给我提供 2 到 3 个**只使用基础 React (如 useState/useEffect) + 原生 Tailwind CSS 动画类名（如 animate-spin, animate-pulse）**就能实现的降级平替方案。
请用大白话列出：
1. 原方案导致 AI 代码生成翻车/依赖冲突的风险。
2. 纯 Tailwind 降级方案 A、B 的可靠性与视觉妥协点。
</Explore>

<Action>
请先不要修改 UI 蓝图，直接把这几个无依赖的平替选项列出来，等我看完后拍板决定。
</Action>


```

---

### 💡 教学应用建议 (赋能高中生 Tech Lead)

在这个环节，必须要向学生传递一个极为高级的架构思维：

> “优秀的 Tech Lead 知道什么时候该对细节妥协。当 AI 架构师给你画了一张带炫酷 3D 动画的饼时，不要去想‘好不好看’，而是要立刻意识到：**‘我手底下的 AI Coder 是个很容易被依赖库搞疯的家伙。’** 把所有需要额外安装复杂包的组件，全部砍成原生的 Tailwind 样式，这就是你在这个阶段保护项目的最高职责。”

至此，**阶段二 (系统设计 System Design)** 的所有核心图纸（PRD、数据契约、UI 蓝图）及对应的双轨制防坑护栏，已经完美收官！

有了这些坚如磐石的“机器可读契约”，我们终于可以进入最激动人心的**阶段三：开发与迭代 (Build & Iterate)**。在这个阶段，前端和后端 Agent 将正式启动并发开发。
准备好迎接 **Prompt 3.1 和 3.2 的工具箱**了吗？那可是管理 AI Coder 越权操作的最后一道物理防火墙！