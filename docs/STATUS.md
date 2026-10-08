# CoXR 项目参考文档

> 面向新加入开发者的快速上手参考。后端与数据库已稳定，不再变动；前端后续仅推进 **XR UI** 部分。

---

## 1. 项目定位

CoXR 是一个 **PC + WebXR 双模式数据协同可视化系统**。团队成员可在同一份 Yjs 文档上同时通过传统 Web 界面（PC）与沉浸式 XR 头显（WebXR）进行协作，共享同一个 three.js 3D 场景。

核心设计原则：
- **同一份数据**：所有状态由 Yjs 文档驱动，PC 与 XR 消费同一份 `SerializedDoc` 快照。
- **PC 职责**：高密度数据管理——记录类型配置、字段编辑、视图筛选/排序、场景元素配置。
- **XR 职责**：沉浸式观察与协同——第一人称浏览 3D 场景，后续补充 XR 内的轻量操作 UI。
- **本地态严格隔离**：`activeViewId`、UI 焦点等 PC 本地状态不写入 Yjs Doc。

---

## 2. Monorepo 结构

```
packages/
  shared/   共享语义模型（类型、常量、Zod schema、Yjs 访问器、纯函数派生）
  server/   Fastify + Hocuspocus + Postgres + Redis + mediasoup SFU
  web/      React + R3F，PC HTML overlay + 3D/XR 共享场景
```

依赖管理：pnpm workspaces；`web` / `server` 均通过 `@coxr/shared` 引用共享包。

---

## 3. `packages/shared`

### 3.1 目录职责

| 目录 | 内容 |
|---|---|
| `types/` | 全部领域模型 TypeScript 类型（`RecordTypeDef`、`ViewConfig`、`SceneItem` 子类型等） |
| `constants/` | 字符串字面量枚举常量 |
| `permissions/` | Permission bit flags；`hasPermission` / `grantPermission` / `revokePermission` |
| `schemas/` | Zod 序列化/反序列化 schema |
| `factory/` | `uuid()`、`createEmptyDoc()` 等基础构造工具；`starter.ts` 包含 mock seed 数据 |
| `derive/` | `applyView()` 纯函数——将 `ViewConfig` 应用到 records 上，返回筛选/排序后的结果 |
| `yjs/` | 所有 Yjs 读写操作，供 server 和 web 复用 |

### 3.2 Yjs Doc 顶层命名空间

| 命名空间 | 类型 | 说明 |
|---|---|---|
| `meta` | `Y.Map` | 文档元数据 |
| `recordTypes` | `Y.Map` | 记录类型定义（字段内嵌） |
| `records` | `Y.Map` | 业务记录；`data` 字段为 `Y.Map`，`longText` 字段为 `Y.Text` |
| `relations` | `Y.Map` | 记录间关系 |
| `views` | `Y.Map` | 查询视图（filter / sort / 字段可见性） |
| `scene` | `Y.Map` | 单例 3D 场景；`scene.items` 为 `Y.Map<itemId, SceneItem>` |
| `annotations` | `Y.Map` | 批注；`body` 为 `Y.Text` |

### 3.3 SceneItem 类型

目前实现了三种图表类型，均存储在 `scene.items` 中：

| 类型 | 字段 | 说明 |
|---|---|---|
| `bar3d` | `xField / yField / zField` | 3D 柱状图；xField/zField 为类别轴，yField 为高度数值轴 |
| `scatter3d` | `xField / yField / zField / colorField / sizeField` | 3D 散点图；三轴均为数值轴 |
| `line3d` | `xField / yField / colorField` | 3D 折线图；colorField 可拆分多系列 |

所有图表均含 `sourceViewId`（数据来源视图）和 `transform3d`（`position / rotation / scale`）。

### 3.4 Yjs 访问器（`yjs/`）

- `initYDoc(doc)`：初始化 YDoc 顶层命名空间
- `seedStarterDoc(doc)`：写入 mock 种子数据（开发/测试用）
- record CRUD：`createRecord` / `updateRecordField` / `deleteRecord`（longText 字段自动映射到 `Y.Text`）
- recordType CRUD：`upsertRecordType` / `deleteRecordType`
- view CRUD：`upsertView` / `deleteView`
- scene item：`upsertSceneItem` / `deleteSceneItem`
- annotation CRUD
- 序列化：`toSerializedDoc(doc)` → `SerializedDoc`（JSON 快照）
- 快照编解码：`encodeDocSnapshot` / `restoreDocFromSnapshot`（Yjs 二进制格式）

---

## 4. `packages/server`

> **已稳定，不再变动。**

### 4.1 技术栈

- **HTTP 框架**：Fastify + `@fastify/cors` + `@fastify/websocket`
- **认证**：`@fastify/jwt`（HS256）+ `fast-jwt`（供 Hocuspocus hook 独立校验）
- **密码哈希**：argon2id（`argon2` 库）
- **Passkey**：`@simplewebauthn/server` v13
- **ORM**：Drizzle ORM + `postgres`（pg 驱动）
- **协同**：Hocuspocus v4 + `@hocuspocus/extension-redis`
- **实时状态**：Redis（ioredis）
- **语音**：mediasoup SFU（单 Worker 单例）

### 4.2 数据库表（Drizzle ORM + Postgres）

| 表 | 说明 |
|---|---|
| `users` | 用户；`permissions` 为 bit flags（LOGIN=1, ADMIN=2）；首位注册用户自动获得 ADMIN |
| `user_password_auth` | argon2id 密码哈希，与 `users` 一对一 |
| `user_webauthn_credentials` | WebAuthn/Passkey 凭证；含 `deviceName`、`signCount` |
| `collaboration_spaces` | 协作空间；含 4 位纯数字 `accessCode`；`status`：OPEN=0 / APPLY_REQUIRED=1 / CLOSED=2 |
| `space_members` | 成员关系；`role`：MEMBER=0 / ADMIN=1 / OWNER=2；`status`：PENDING=0 / APPROVED_PENDING_JOIN=1 / ACTIVE=2 / REJECTED=3 / LEFT=4 / REMOVED=5 |
| `space_event_logs` | 操作事件日志（加入、踢出、审批等） |
| `space_snapshots` | YDoc 二进制快照（`yjsDocument` 为 base64，解码后为 Yjs 二进制） |

### 4.3 REST API

**认证**

| 端点 | 说明 |
|---|---|
| `POST /api/auth/register` | 注册（首用户自动获得 ADMIN） |
| `POST /api/auth/login` | 密码登录，返回 JWT |
| `POST /api/auth/webauthn/register/begin` | 生成 Passkey 注册 options（需 JWT） |
| `POST /api/auth/webauthn/register/complete` | 完成 Passkey 注册（需 JWT） |
| `POST /api/auth/webauthn/login/begin` | 生成 Passkey 认证 options，返回 `sessionId` |
| `POST /api/auth/webauthn/login/complete` | 完成 Passkey 认证，返回 JWT |
| `GET /api/auth/webauthn/credentials` | 当前用户所有通行证列表（需 JWT） |
| `DELETE /api/auth/webauthn/credentials/:id` | 删除通行证（无密码账号禁止删最后一个） |

**用户**

| 端点 | 说明 |
|---|---|
| `GET /api/user/me` | 获取当前用户信息 |
| `PATCH /api/user/me` | 更新昵称 |
| `PATCH /api/user/me/password` | 修改密码（校验原密码） |

**空间**

| 端点 | 说明 |
|---|---|
| `POST /api/spaces` | 创建协作空间 |
| `GET /api/spaces/mine` | 我加入的空间列表 |
| `GET /api/spaces/:spaceId` | 空间详情（需为成员） |
| `DELETE /api/spaces/:spaceId` | 退出（成员）或解散（所有者） |
| `POST /api/spaces/join` | 通过 `accessCode` 申请加入 |
| `PATCH /api/spaces/:spaceId/status` | 修改空间开放状态（需 admin/owner） |
| `GET /api/spaces/:spaceId/members` | 成员列表 + 自己的 role |
| `GET /api/spaces/:spaceId/applications` | 申请列表（需 admin/owner） |
| `GET /api/spaces/:spaceId/removed-members` | 被移除成员列表（需 admin/owner） |
| `POST /api/spaces/:spaceId/members/:targetUserId/kick` | 踢出成员 |
| `POST /api/spaces/:spaceId/members/:targetUserId/unkick` | 恢复被踢成员 |
| `POST /api/spaces/:spaceId/applications/:targetUserId/approve` | 审批通过申请 |
| `POST /api/spaces/:spaceId/applications/:targetUserId/reject` | 拒绝申请 |
| `POST /api/spaces/:spaceId/snapshots` | 创建快照 |
| `GET /api/spaces/:spaceId/snapshots` | 快照列表 |
| `DELETE /api/spaces/:spaceId/snapshots/:snapshotId` | 删除快照 |
| `POST /api/spaces/:spaceId/snapshots/:snapshotId/restore` | 恢复快照，返回 base64 |

**数据导入**

| 端点 | 说明 |
|---|---|
| `POST /api/import/fetch-url` | 从公网 HTTP/HTTPS URL 获取 CSV（含 SSRF 防护） |
| `POST /api/import/db-query` | 代理查询外部 Postgres / SQLite 数据库 |

### 4.4 WebSocket 端点

**Yjs 协同**：`/ws`
- 协议：Hocuspocus v4（手动集成模式）
- `documentName` 格式：`space:<spaceId>`
- 认证：`fast-jwt` 验证 JWT + 查 `space_members` 确认 ACTIVE 或 APPROVED_PENDING_JOIN 状态
- 首次连接时若为 APPROVED_PENDING_JOIN，自动升级为 ACTIVE 并广播 `refresh_members`
- 断开时降回 APPROVED_PENDING_JOIN（多 tab 时不降级）
- 实时状态存 Redis，不自动写 PG

**语音**：`/voice`
- 协议：自定义 JSON RPC over WebSocket + mediasoup SFU
- 认证：连接时传 JWT，验证后加入对应 `spaceId` 的语音房间
- `VoiceRoomManager`：单例，持有一个 mediasoup Worker；每个 spaceId 对应一个 `VoiceRoom`（Router）
- 每个 peer 维护 `sendTransport`（上行）+ `recvTransport`（下行）+ `producer` + `consumers`
- 离开时自动通知房间内其他参与者

### 4.5 Passkey 实现细节

- Challenge 存 Redis，TTL 300s，`sessionId` 作为 key
- RP 配置：环境变量 `WEBAUTHN_RP_ID` / `WEBAUTHN_RP_NAME` / `WEBAUTHN_RP_ORIGIN`
- 登录流程无需预先输入用户名（浏览器 discoverable credential），服务端从 `userHandle` 反查用户

---

## 5. `packages/web`

### 5.1 技术栈

- React + TypeScript，Vite 构建
- 3D：`@react-three/fiber` + `@react-three/drei` + `three.js`
- XR：`@react-three/xr`
- 协同：`@hocuspocus/provider`
- 状态：Zustand（`authStore` / `spaceStore` / `spaceUIStore` / `voiceStore`）
- UI：Tailwind CSS + Radix Dialog + shadcn/ui 组件
- 通知：sonner

### 5.2 整体渲染架构

```
App
├── <DocProvider>           ← Yjs provider，管理 HocuspocusProvider 生命周期
├── <Canvas>                ← R3F，PC 与 XR 共享同一个 three.js Canvas
│   └── <XR store={xrStore}>
│       ├── <XRPointerEventsBridge>   ← 仅 XR session 中桥接控制器射线事件
│       ├── <Scene>                   ← 世界内容，不感知 PC/XR 模式
│       │   ├── <Environment>
│       │   ├── <Floor>
│       │   └── <Charts>              ← 所有 SceneItem 渲染
│       ├── <ModeSwitch>              ← 切换 PCRig / XRRig
│       └── <XRShell>                 ← XR 专属 3D UI（待开发）
└── <PCShell>               ← PC 专属 HTML overlay，进入 XR 后自动隐藏
    ├── <FloatingMenu>      ← 可拖拽浮球菜单，展开后有空间/账户/快照/成员/语音等入口
    └── Navigator + DetailPanel  ← 仅 activeSpace 存在且 navigatorOpen 时渲染
```

**PC / XR 切换机制**：
- `<ModeSwitch>` 检测 `useXR(s => s.session != null)`，XR session 激活时换 `<XRRig>`，否则用 `<PCRig>`
- `<PCShell>` 在 XR 中返回 null，HTML overlay 整体隐藏
- `<XRPointerEventsBridge>` 仅在 XR session 中挂载 `<PointerEvents>`，避免替换 PC 的 R3F DOM 事件

### 5.3 DocContext（数据层核心）

`packages/web/src/data/DocContext.tsx`

- `spaceId` 不为 null：创建/复用 `HocuspocusProvider`，连接 `ws://.../ws`，JWT 自动注入
- `spaceId` 为 null：回退本地单例 YDoc + `seedStarterDoc`（开发模式）
- 通过 `useSyncExternalStore` 订阅 Yjs `update` 事件，派生并缓存 `SerializedDoc` 快照
- 对外暴露完整的 CRUD 操作：`createRecord` / `setRecordField` / `deleteRecord` / `upsertRecordType` / `deleteRecordType` / `upsertView` / `deleteView` / `upsertSceneItem` / `removeSceneItem`
- `getDocAsBase64()`：将当前 YDoc 编码为 Yjs 二进制再转 base64，供快照接口使用
- `restoreFromSnapshot(base64)`：恢复快照到当前 YDoc

### 5.4 状态管理（Zustand stores）

| Store | 内容 |
|---|---|
| `authStore` | 用户信息（`user`）、登录状态、`checkAuth()`（从 localStorage JWT 恢复） |
| `spaceStore` | 空间列表、`activeSpace`（当前激活空间） |
| `spaceUIStore` | `focus`（当前聚焦的对象）、`navigatorOpen`、`detailPanelVisible`、`memberListKey` / `applicationListKey`（用于触发列表刷新） |
| `voiceStore` | `isConnected`、`micEnabled`、`globalMuted`、`participants`（含每人 `producerId` 和 `localMuted`） |

### 5.5 PC HTML Overlay

**FloatingMenu**（`pc/FloatingMenu.tsx`）

可拖拽的浮球，展开后呈扇形排列菜单项：
- 空间管理（SpaceModal）
- 账户设置（UserModal）
- 面板切换（toggleNavigator，有 activeSpace 时出现）
- 快照管理（SnapshotModal，有 activeSpace 时出现）
- 成员管理（MemberModal，有 activeSpace 时出现）
- 语音（VoiceModal，有 activeSpace 时出现）

**Navigator**（`pc/Navigator.tsx`）

左侧导航栏，按 Section 折叠展示：
- **数据库**（RecordTypes）：列出所有记录类型，可新增；点击聚焦到 `RecordTypePanel`
- **视图**（Views）：列出所有视图，可新增；点击聚焦到 `ViewPanel`
- **场景元素**（Scene Items）：列出所有 SceneItem，可新增（`bar3d` / `scatter3d` / `line3d`）；点击聚焦到 `SceneItemPanel`

**DetailPanel**（`pc/panels/DetailPanel.tsx`）

右侧详情面板，根据 `spaceUIStore.focus` 的 `kind` 路由到对应子面板：

| focus.kind | 面板 | 功能 |
|---|---|---|
| `recordType` | `RecordTypePanel` | 字段列表管理（增/删/改类型/改顺序）；select/multiSelect 有颜色选项编辑器；支持从 CSV / HTTP URL / 外部数据库导入数据 |
| `view` | `ViewPanel` | 内嵌表格（类 Notion）；支持 filter / sort 配置；所有字段类型可内联编辑（text/number/boolean/select/multiSelect/date/url/longText）；可新增/删除记录；点击记录行聚焦到 `RecordDetailPanel` |
| `record` | `RecordDetailPanel` | 单条记录的全字段详情编辑，所有字段类型均可编辑；longText 用 textarea |
| `sceneItem` | `SceneItemPanel` | 图表配置（选类型/sourceViewId/字段映射/transform3d）；支持增删 SceneItem |

**其他 Modal**

- `AuthModal`：登录/注册双模式 + Passkey 一键登录按钮
- `SpaceModal`：我的空间列表 / 创建空间 / 加入空间（三面板）
- `UserModal`：个人资料（改昵称）/ 密码修改 / 通行证管理（含注册新通行证、删除）
- `SnapshotModal`：快照列表、创建快照、删除快照、恢复快照（含确认对话）
- `MemberModal`：成员列表（含踢出）/ 申请列表（审批/拒绝）/ 已移除成员（恢复）
- `VoiceModal`：参与者列表、开/关麦克风、全局静音、单独静音某人

### 5.6 3D 场景（Scene & Charts）

`packages/web/src/scene/`

- `Scene.tsx`：根场景入口，仅挂载 `<Environment>` + `<Floor>` + `<Charts>`，不感知 PC/XR
- `charts/index.tsx`（`<Charts>`）：从 `DocContext` 读取 `doc.scene.items`，按类型分发到各图表组件

**图表组件**

| 组件 | 对应 SceneItem | 关键实现 |
|---|---|---|
| `Bar3DChart` | `bar3d` | 柱子高度归一化到 `MAX_BAR_H=4`；点击柱子弹出 `Billboard` 数据卡片；PC 模式下支持 `TransformControls` 拖拽，drag 期间挂起 `OrbitControls` |
| `Scatter3DChart` | `scatter3d` | XYZ 三轴归一化到 `SCENE_RANGE=4`；球体大小可选映射到 `sizeField`；颜色映射到 `colorField`；点击弹出数据卡片 |
| `Line3DChart` | `line3d` | 沿 X 轴排列，Y 轴为高度；`colorField` 拆分多系列折线 |

**通用特性**：
- 所有 3D 文字使用 `@react-three/drei` 的 `<Text>`，字体统一为 `FONTS.DEFAULT`（`AlibabaPuHuiTi-3-65-Medium.ttf`，通过 `/public/font/` 路径加载，首次加载有约 10MB 延迟）
- `Billboard` 组件确保数据卡片始终朝向相机
- `applyView()` 纯函数在图表内部执行，将 `sourceViewId` 对应的 ViewConfig 应用到 records

### 5.7 Rig（相机/控制器）

| 组件 | 模式 | 实现 |
|---|---|---|
| `PCRig` | PC | `PerspectiveCamera` + `OrbitControls`（左键旋转、中键平移、滚轮缩放；限制极角防止穿地） |
| `XRRig` | XR | `XROrigin` 置于世界原点，头显高度由设备 reference space 提供 |
| `ModeSwitch` | — | 检测 XR session 状态，动态切换两套 Rig |

### 5.8 语音（Voice）

`packages/web/src/voice/useVoiceManager.ts`

- 挂载在 `PCShell` 中，`activeSpace` 有值时自动建立 Voice WebSocket（`/voice`）连接
- 使用 `mediasoup-client` 建立 WebRTC `Device`，自动创建 `sendTransport` + `recvTransport`
- `micEnabled` 变化时动态创建/关闭 `Producer`
- 远端参与者通过 `Consumer` 接收音频，挂载到 `HTMLAudioElement`（ref map 管理）
- `localMuted` / `globalMuted` 直接控制 `audio.muted`，不影响媒体流传输
- 退出空间时断开所有连接，重置 `voiceStore`

### 5.9 API 层

`packages/web/src/api/`

- `client.ts`：统一 `request()` 函数，自动从 localStorage 注入 JWT，统一处理 `ApiError`
- `auth.ts`：`login` / `register`
- `user.ts`：`getMe` / `patchMe` / `changePassword`
- `spaces.ts`：全部空间、成员、申请、快照接口
- `passkey.ts`：`passkeyApi.register()` / `passkeyApi.login()` / `passkeyApi.list()` / `passkeyApi.delete()`（封装两阶段 WebAuthn 流程）

### 5.10 ImportDataModal

`packages/web/src/pc/panels/ImportDataModal.tsx`

五步向导（`source_type` → `source_config` → `field_select` → `field_mapping` → `confirm`）：

1. 选择数据源：本地 CSV 文件 / HTTP URL / 外部数据库（Postgres 或 SQLite）
2. 配置数据源（文件上传 / URL + 请求头 / 数据库连接参数）
3. 选择要导入的表/字段
4. 字段映射（列名 → 字段名，类型推断，可自定义）
5. 确认并写入 Yjs Doc（创建 RecordType + 批量 createRecord）

---

## 6. 待开发：XR UI

`packages/web/src/xr/XRShell.tsx` 当前为空占位组件（仅在 XR session 激活时渲染）。

后续所有 XR 专属的 3D 菜单、面板、操作 UI 均挂载于此。参考实现要点：

- **字体**：XR 内 3D 文字同样使用 `FONTS.DEFAULT`；`@react-three/uikit` 面板需要另行生成 MSDF 中文字集（参见 `docs/../memories/repo/fonts.md`）
- **布局**：`@react-three/uikit` 适合构建 3D 面板；`Billboard` 适合跟随相机的 HUD 元素
- **事件**：XR 中通过 `@react-three/xr` 的 `PointerEvents`（已在 `App.tsx` 中桥接）接收控制器射线 hit 事件
- **状态**：复用已有的 `DocContext` / `spaceStore` / `spaceUIStore`，无需引入新的数据层

---

## 7. 环境变量

**server**（`.env`）

```
DATABASE_URL=        Postgres 连接串
REDIS_URL=           Redis 连接串
JWT_SECRET=          JWT 签名密钥
JWT_EXPIRES_IN=      JWT 过期时间（如 7d）
WEBAUTHN_RP_ID=      RP ID（通常为域名，本地开发用 localhost）
WEBAUTHN_RP_NAME=    RP 显示名称
WEBAUTHN_RP_ORIGIN=  RP Origin（如 http://localhost:5173）
HOST=                监听地址（默认 0.0.0.0）
PORT=                监听端口（默认 3000）
```

**web**（`.env`）

```
VITE_API_BASE_URL=   HTTP API 基址（如 http://localhost:3000）
VITE_WS_URL=         Yjs 协同 WebSocket（如 ws://localhost:3000/ws）
VITE_WS_BASE_URL=    Voice WebSocket 基址（如 ws://localhost:3000）
```

