# Prompt 2.2：生成前后端数据契约与 Mock 数据

```text
<Role>
你是后端架构师，按 Contract-First 编写 API 契约。契约要能同时指导前端 Mock 开发与后端实现。
</Role>

<Context>
技术栈默认：Python + FastAPI（若 README/PRD 另有指定，以项目为准）。
前后端将并行开发：前端可先用 Mock，但 Schema 必须是真实接口的形状，而不是「演示用简化版」。
需要鉴权、资源 id、时间戳、分页时，必须写进契约。
</Context>

<Input>
读取：@docs/PRD.md
</Input>

<Task>
不要写业务实现代码。根据 PRD 的 Must Have 与 Entity Flow，输出 `docs/schema.md`。
覆盖主路径和关键错误路径。
</Task>

<Output>
文件：`docs/schema.md`

## 0. 约定
- Base URL（如 `/api/v1`）
- 鉴权方式（无 / Cookie Session / Bearer Token 等）与未授权时的响应
- 通用错误包络（字段、HTTP 状态码）
- 时间格式、id 类型、分页参数（若需要）

## 1. 接口列表
每个资源一组。每个接口包含：
- Path / Method
- 是否鉴权
- 一句话职责
- Request：路径参数、Query、Headers、JSON body；字段类型、必填、约束
- Response：成功 body + 主要错误（400/401/403/404/409/422/502 等按实际需要）

结构规则：
- 嵌套深度按领域需要，避免无意义的多层包装。
- 资源用稳定 id；创建/更新应有时间戳（若 PRD 需要持久化）。
- 模型输出若存在，拆成前端可绑定的字段，不要只给一个无结构的 `content` 大字符串（除非产品就是自由文本）。

## 2. Mock 数据
为每个主接口提供：
- 1 份成功响应（内容贴合 Persona，禁止 `foo`/`test`）
- 1 份至少一种错误响应
前端会用这些数据做空态/错误态，不只做「理想成功卡片」。
</Output>
```

---

### 人类核对

1. **与 PRD 对齐**：每个 Must 能力都有接口或明确的前端本地状态；缺的补，多的删。
2. **结构是否可读**：必要嵌套保留（如 `items[]` + `pagination`）；不要为了「扁平」把无关字段堆在一层，也不要三层以上的无意义包装。
3. **状态字段**：需要用户体系或存储时，应有 `id`、鉴权、时间戳；不需要时再省略。不要因为「怕 ORM」而删掉领域里应有的字段。
4. **Mock 完整**：成功 + 错误；文本长度接近真实，便于测排版。

---

# 迭代沟通工具箱（双轨）

---

## 轨道一：硬性否决

### 错误 1：无意义深嵌套，或扁平到无法表达列表/分页

```text
<Reject>
Schema 要么包装过深（多层无意义对象），要么为了扁平丢掉了列表、分页或资源关系，前端无法稳定绑定。
</Reject>

<Anchor>
允许的典型形状：`{ data: T, error: null }` 或 `{ items: T[], page, total }`。
禁止 `data.result.payload.user.profile...` 这种无领域意义的套娃。
列表就用数组，不要把多项拆成 `item1` `item2`。
</Anchor>

<Action>
重写相关 Request/Response，并同步更新 Mock。
</Action>
```

### 错误 2：字段与 PRD 矛盾

```text
<Reject>
契约里出现了 PRD 未定义的资源，或主故事需要的鉴权/存储字段缺失。
</Reject>

<Anchor>
以 PRD 为准。需要登录就定义注册/登录/当前用户与 401；需要保存就定义 id 与读写接口。
不要为了「无状态」删掉产品需要的状态。
</Anchor>

<Action>
对照 PRD Must Have 逐条补全或删除接口与字段，再出 Mock。
</Action>
```

### 错误 3：Mock 只有占位符或只有成功态

```text
<Reject>
Mock 是 `test`/`foo`，或只有成功、没有校验失败与未授权。
</Reject>

<Anchor>
成功数据要像真实业务结果。再补至少一种 4xx/401 示例，便于前端做错误 UI。
</Anchor>

<Action>
保持 Schema 不变，重写 Mock 段落。
</Action>
```

---

## 轨道二：柔性咨询

### 疑虑：传输方式是否匹配交互

**触发**：一次性分析却用了 SSE；在线对战却只用单次 POST；或引入 GraphQL/gRPC 但团队没有约定。

```text
<Doubt>
接口准备用【填写：SSE / WebSocket / GraphQL / 仅 POST】。我不确定这是否匹配 PRD 里的交互，以及联调成本是否必要。
</Doubt>

<Explore>
先不要改 schema.md。对比：
1. 产品交互是否真的需要流式/双向
2. 第一版最小协议（例如：需要落子同步就 WebSocket；需要长推理就 SSE 或轮询）
3. CORS、鉴权、重连如何处理
列出优缺点，等我选后再改契约。
</Explore>

<Action>
只输出评估，不改文件。
</Action>
```
