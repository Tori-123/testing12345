<Prompt 2.2：生成前后端数据契约 (API Schema) 与 Mock 数据>


# Prompt 2.2：生成前后端数据契约 (API Schema) 与 Mock 数据

<Role>
你是一名拥有极高工程素养的首席后端架构师。
</Role>

<Context>
我们正在进行 36 小时的 AI 黑客松，团队采取“多智能体并发开发”模式（前端与后端同时开工）。
后端的指定技术栈为：Python + FastAPI。
我们的核心开发原则是 Contract-First（契约先行）。前端和后端的 AI 智能体将以此契约为唯一标准进行平行的自动代码生成。
</Context>

<Input>
请读取项目文件：@docs/PRD.md
</Input>

<Task>
请不要输出任何业务逻辑代码！你的任务是根据 PRD 中的“Must Have 核心体验回路”和“Entity Flow”，定义出极其严谨的 RESTful API 接口契约，并输出为一份 `@docs/schema.md` 文档。
</Task>

<Output>
文件名称：`@docs/schema.md`
请严格遵循以下结构输出（文档内需包含接口定义及 JSON 代码块）：

## 1. API 路由定义 (Endpoint)
- Path: (例如 `POST /api/v1/analyze`)
- Method: (GET/POST)
- Description: (用一句话概括这个接口的作用，强调它是调用大模型的核心节点)

## 2. 请求数据结构 (Request Schema)
前端发给后端的 JSON 结构。
- 务必扁平化（Flatten），绝对避免超过两层的深度嵌套。
- 明确标注各个字段的类型（String, Int, Boolean 等）以及是否为必填项（Required）。

## 3. 响应数据结构 (Response Schema)
后端处理完毕（或大模型返回后）返回给前端的 JSON 结构。
- 必须包含标准的状态码（如 `status: "success" | "error"`）或错误信息字段。
- 大模型的返回结果必须被严格结构化（例如拆分为 `summary`, `details`, `action_items` 等独立字段），绝不允许将大段 Markdown 文本直接塞进单一的 `content` 字段中。

## 4. 前端救命稻草：逼真的 Mock JSON 数据
这是最重要的一步，前端的 AI 智能体现在立刻就需要拿着假数据去生成 UI 组件。
- 请直接输出一段极其逼真、符合上述 Response Schema 的完整 JSON 代码块。
- 数据内容必须紧贴我们 Persona 的具体情境，绝对禁止使用 "test"、"foo" 这种无意义占位符，要像真实大模型返回的结果一样生动丰富。
</Output>

## 1. API 路由定义 (Endpoint)

* Path: (例如 `POST /api/v1/analyze`)
* Method: (GET/POST)
* Description: (用一句话概括这个接口的作用，强调它是调用大模型的核心节点)

## 2. 请求数据结构 (Request Schema)

前端发给后端的 JSON 结构。

* 务必扁平化（Flatten），绝对避免超过两层的深度嵌套。
* 明确标注各个字段的类型（String, Int, Boolean 等）以及是否为必填项（Required）。

## 3. 响应数据结构 (Response Schema)

后端处理完毕（或大模型返回后）返回给前端的 JSON 结构。

* 必须包含标准的状态码（如 `status: "success" | "error"`）或错误信息字段。
* 大模型的返回结果必须被严格结构化（例如拆分为 `summary`, `details`, `action_items` 等独立字段），绝不允许将大段 Markdown 文本直接塞进单一的 `content` 字段中。

## 4. 前端救命稻草：逼真的 Mock JSON 数据

这是最重要的一步，前端的 AI 智能体现在立刻就需要拿着假数据去生成 UI 组件。

* 请直接输出一段极其逼真、符合上述 Response Schema 的完整 JSON 代码块。
* 数据内容必须紧贴我们 Persona 的具体情境，绝对禁止使用 "test"、"foo" 这种无意义占位符，要像真实大模型返回的结果一样生动丰富。


---

### 🛑 人类干预点 (The "Human-in-the-Loop" Checkpoint)

当 AI 吐出这份 `@docs/schema.md` 后，作为 Tech Lead 的学生必须执行以下 **“跨海大桥验收标准”**：

1. **扁平化审查（Anti-Nesting Check）**：
看一眼 Request 和 Response 的 JSON 结构。如果有类似 `data: { user: { profile: { age: 18 } } }` 这种俄罗斯套娃一样的嵌套，立刻打回。**对于后续接手写代码的 AI Agent 来说，嵌套越深，它在生成数据绑定代码时产生字段幻觉（读取不存在的属性）引发 `undefined` 报错的概率就越高。**
2. **脱离数据库思维（Stateless Check）**：
检查 Schema 里有没有出现 `user_id`, `session_token`, `created_at` 等典型的数据库字段。在 PRD 里明确说了“不搞真实数据库”，如果这里保留了状态字段，后端的 AI Agent 就会在写代码时强行发明数据库连接池，导致项目瞬间崩盘。
3. **Mock 数据代入感**：
看着最后那段 Mock JSON，问自己：“前端 AI 拿着这段数据渲染出来的卡片好看吗？”如果数据太干瘪，打回重写。

完成这一步，我们的“桥墩”就彻底打好了。前端 AI 拿着 Mock JSON 去写界面代码，后端 AI 拿着 Schema 去写 FastAPI，完美并发。

</Prompt 2.2：生成前后端数据契约 (API Schema) 与 Mock 数据>

---



# 🧰 阶段二：Prompt 2.2 迭代沟通工具箱 (双轨制 Follow-up Templates)

进入阶段二的核心枢纽 **Prompt 2.2 (生成前后端数据契约与 Mock 数据)**，这是决定前后端 AI 能否顺利“会师”的生死线。

大模型在设计 API Schema 时，极容易犯“过度设计”的工程师通病。它们喜欢设计完美的、支持无限扩展的俄罗斯套娃式 JSON，或者情不自禁地加入鉴权与数据库字段。**复杂的契约会让负责执行的 AI Agent 陷入极大的认知负担，最终在解构数据时导致满屏的报错。**

当 AI 吐出 `docs/schema.md` 后，Tech Lead 必须问自己：“**这个 JSON 是不是嵌套太多层了？如果让前端 AI 去读这个结构，它会不会因为找不到字段而代码崩溃？它有没有提出容易引发网络配置地狱的接口协议？**”

如果 JSON 像俄罗斯套娃，或者带有 `user_id`，请走**轨道一（硬性否决）**；如果 AI 建议你用“GraphQL”或“SSE 实时流传输”来返回数据，请走**轨道二（柔性咨询）**。

## 🚄 轨道一：Hard Override (硬性否决机制)

**核心逻辑**：`Reject (拒绝)` -> `Anchor (重申规则)` -> `Action (重写指令)`

#### ❌ 错误情况 1：JSON 嵌套太深 (Over-nesting / 俄罗斯套娃)

**触发时机**：AI 给出的 JSON 结构超过了 2 层深度（例如出现了 `data: { result: { user_profile: { analysis: "..." } } }`）。嵌套越深，后续的前端 AI Agent 在解构数据时越容易产生幻觉代码。

**纠偏提示词**：

```text
<Reject>
这份数据契约极易让后续写代码的 AI 陷入报错地狱！你的 JSON 结构嵌套太深，像俄罗斯套娃一样。这会导致前端 AI Agent 在生成解构代码时极容易产生字段幻觉，引发无尽的 undefined 错误。
</Reject>

<Anchor>
请贯彻“扁平化 (Flatten)”原则，这是保护多智能体协同的底线。把 Request 和 Response 的 JSON 结构彻底拍平，绝对不允许出现超过 2 层的对象嵌套。所有核心字段请直接提拔到第一层。
</Anchor>

<Action>
请修改并重新输出一份极简、极度扁平化的 `docs/schema.md` 文件。
</Action>


```

#### ❌ 错误情况 2：混入数据库思维 (Stateful Fields / 状态化污染)

**触发时机**：你在这份无状态的 API 契约中，看到了 `user_id`, `session_token`, `created_at` 等字段。一旦保留这些，后端 AI 写代码时就会“自作主张”去连接数据库。

**纠偏提示词**：

```text
<Reject>
停！你的 Schema 里出现了带有数据库思维的字段。我强调过我们不搞真实数据库，也不做用户登录。留下这些字段会让后端 AI 误以为需要引入 ORM 和数据库依赖。
</Reject>

<Anchor>
请立刻脱离传统后端的增删改查思维。保持接口纯粹的“无状态（Stateless）”。我们只需要一次性的输入和一次性的输出，绝对不要传递任何身份标识或时间戳。
</Anchor>

<Action>
请无情地删掉所有涉及数据库、存储、鉴权的冗余字段，重新输出绝对纯净的 `docs/schema.md`。
</Action>


```

#### ❌ 错误情况 3：Mock 数据敷衍了事 (Dry Mock Data)

**触发时机**：文档最后提供的 Mock JSON 假数据里，全是 `"test"`, `"foo"`, `"这是一段分析"` 这种毫无意义的占位符。前端 AI 拿着这种数据根本无法帮你测出真实的 UI 排版溢出问题。

**纠偏提示词**：

```text
<Reject>
你最后提供的 Mock JSON 数据太敷衍了！全是毫无意义的占位符。前端 AI 如果拿这段干瘪的数据去写 UI，我们根本测不出真实字数下的排版效果和 CSS 换行逻辑。
</Reject>

<Anchor>
请记住，这段 Mock 数据是前端在后端跑通前的“救命稻草”。
请你彻底代入大模型的角色，根据我们 Persona 的具体情境，真刀真枪地写出一段逼真、生动、字数丰富的输出结果。
</Anchor>

<Action>
请保持 Schema 结构不变，但把最后面的 Mock JSON 代码块扩充至少 3 倍的内容量。写得越像真实的大模型返回结果越好！
</Action>


```

---

## 🛳️ 轨道二：Soft Consult (柔性咨询机制)

**核心逻辑**：`Doubt (表达疑虑)` -> `Explore (索要评估与平替)` -> `Decide (人类拍板，此处仅展示提问阶段)` -> `Action (暂不修改，等待指令)`

大模型在处理“大段文本返回”时，极有可能会向你推销高级的通信协议，最典型的就是推销 **SSE (Server-Sent Events)** 或是 **WebSocket** 来实现打字机效果。这种协议在本地联调跨域（CORS）时往往是灾难级的，极容易让 AI 陷入反复修改配置的死循环。

#### ⚠️ 疑虑情况：引入复杂的接口协议 (Complex Protocols)

**触发时机**：AI 建议不要用普通的 HTTP POST，而是建议你使用 SSE (流式传输)、GraphQL 或者 gRPC。

**咨询提示词**：

```text
<Doubt>
停一下。你在接口定义中提到了使用 [填入技术名词，如：SSE 流式传输 / GraphQL] 来返回大模型的数据。考虑到后续全靠 AI Agent 自动写代码，我非常担心引入这种非基础的通信协议会让 AI 在处理跨域 (CORS) 或底层环境配置时陷入无法自动修复的报错死循环。
</Doubt>

<Explore>
请你暂时脱离“架构师”的状态，切换为我的“技术导师”。
请基于我们“只有 36 小时、全部依赖 AI 自动生成代码、极度害怕网络环境配置翻车”的极端客观条件，帮我重新评估这个接口协议的致死率。
如果它极易导致 AI 生成代码时翻车，请给我提供 1 到 2 个**极其降智、哪怕看起来很“笨”**的降级平替方案。比如：我们能不能前后端只用最基础的 HTTP POST 拿完整数据，然后在前端用 JS 假装实现打字机动画？
并用大白话列出每个方案的：
1. 后续 AI Agent 代码生成的一次性成功率
2. 优点 (Pros)
3. 缺点/妥协点 (Cons)
</Explore>

<Action>
请先不要修改 Schema 文档，直接把这几个选项列出来，等我看完后拍板决定。
</Action>


```