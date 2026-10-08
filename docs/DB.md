## 用户表 `users`

| 字段名          | 类型            | 说明           |
| --------------- | --------------- | -------------- |
| `id`          | `uuid`        | 主键，UUID v4  |
| `username`    | `varchar(64)` | 全局唯一登录名 |
| `nickname`    | `varchar(64)` | 展示昵称       |
| `permissions` | `integer`     | 位权限         |
| `created_at`  | `timestamptz` | 创建时间       |

### `permissions` 采用 bit 设定

* `1`：可登录
* `2`：管理员


## 密码认证表 `user_password_auth`

| 字段              | 类型            | 说明              |
| ----------------- | --------------- | ----------------- |
| `user_id`       | `uuid`        | 用户ID，主键/外键 |
| `password_hash` | `text`        | 密码哈希          |
| `created_at`    | `timestamptz` | 创建时间          |
| `updated_at`    | `timestamptz` | 更新时间          |


## Passkey 凭证表 `user_webauthn_credentials`

| 字段              | 类型             | 说明                             |
| ----------------- | ---------------- | -------------------------------- |
| `id`            | `uuid`         | 主键                             |
| `user_id`       | `uuid`         | 所属用户                         |
| `credential_id` | `bytea`        | WebAuthn credential id，全局唯一 |
| `public_key`    | `bytea`        | 公钥                             |
| `sign_count`    | `bigint`       | 签名计数器                       |
| `transports`    | `jsonb`        | transports 信息                  |
| `aaguid`        | `uuid`         | 认证器 AAGUID                    |
| `device_name`   | `varchar(128)` | 用户可见设备名                   |
| `created_at`    | `timestamptz`  | 创建时间                         |
| `last_used_at`  | `timestamptz`  | 最后使用时间                     |


## 协同空间表 `collaboration_spaces`

| 字段名              | 类型            | 说明              |
| ------------------- | --------------- | ----------------- |
| `id`              | `uuid`        | 主键，空间 ID     |
| `access_code`     | `char(4)`     | 4 位纯数字访问码  |
| `creator_user_id` | `uuid`        | 创建者用户 ID     |
| `owner_user_id`   | `uuid`        | 当前所有者用户 ID |
| `status`          | `smallint`    | 房间状态          |
| `created_at`      | `timestamptz` | 创建时间          |

### `status`

* `0` 开放
* `1` 加入需申请
* `2` 禁止加入


## 快照表 `space_snapshots`

| 字段                   | 类型             | 说明          |
| ---------------------- | ---------------- | ------------- |
| `id`                 | `uuid`         | 快照ID        |
| `space_id`           | `uuid`         | 房间ID        |
| `name`               | `varchar(128)` | 快照名        |
| `yjs_document`       | `bytea`        | Yjs序列化文档 |
| `created_by_user_id` | `uuid`         | 谁创建的快照  |
| `created_at`         | `timestamptz`  | 创建时间      |


## 房间成员表 `space_members`

| 字段               | 类型            | 说明               |
| ------------------ | --------------- | ------------------ |
| `id`             | `uuid`        | 主键               |
| `space_id`       | `uuid`        | 房间ID             |
| `user_id`        | `uuid`        | 用户ID             |
| `member_role`    | `smallint`    | 房间内角色         |
| `member_status`  | `smallint`    | 成员状态           |
| `last_joined_at` | `timestamptz` | 最后加入时间，可选 |
| `last_left_at`   | `timestamptz` | 最后离开时间，可选 |
| `created_at`     | `timestamptz` | 成员关系创建时间   |
| `updated_at`     | `timestamptz` | 状态更新时间       |

### `member_role`

* `0` 普通成员
* `1` 空间管理员
* `2` 空间所有者

### `member_status`

* `0` pending：申请中
* `1` approved_pending_join：申请已通过，待正式加入
* `2` active：已加入/有效成员
* `3` rejected：申请被拒
* `4` left：曾加入但已离开
* `5` removed：被移除


## 日志表 `space_event_logs`

| 字段               | 类型            | 说明                   |
| ------------------ | --------------- | ---------------------- |
| `id`             | `bigserial`   | 主键                   |
| `space_id`       | `uuid`        | 房间ID                 |
| `user_id`        | `uuid`        | 事件发起用户           |
| `target_user_id` | `uuid`        | 事件作用对象用户，可空 |
| `event_type`     | `varchar(32)` | 事件类型               |
| `event_data`     | `jsonb`       | 事件附加信息           |
| `created_at`     | `timestamptz` | 发生时间               |

### `event_type`

* `join`
* `leave`
* `apply_join`
* `reject_join`
* `approve_join`
* `create_space`
* `transfer_ownership`
* `create_snapshot`
* `restore_snapshot`
* ...待补充
