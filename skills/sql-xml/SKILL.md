---
name: sql-xml
description: sql-xml规范文档，涵盖Entity设计、Mapper接口定义、XML编写规范以及高级SQL技巧等方面，适用于所有使用MyBatis-Plus进行数据访问的模块。
---




# sql-xml Skill

## 概述
本规范文档旨在统一项目中SQL-XML的编写风格和最佳实践，提升代码质量和维护效率。涵盖Entity设计、Mapper接口定义、XML编写规范以及高级SQL技巧等方面，适用于所有使用MyBatis-Plus进行数据访问的模块。

**技术栈**: RuoYi-Vue + MyBatis-Plus + Lombok + MySQL 8.0+

---

## 1. Entity层规范

### 1.1 继承体系

```
BaseEntity (common模块，实现Serializable)
    ├── TreeEntity (树形结构基类，增加parentId/parentName/orderNum/ancestors/children)
    └── 所有业务实体
```

**BaseEntity标准字段**:
| 字段 | 类型 | 说明 | 是否数据库字段 |
|------|------|------|---------------|
| searchValue | String | 搜索值 | 否 `@TableField(exist = false)` |
| createBy | String | 创建者 | 是 |
| createTime | Date | 创建时间 | 是 |
| updateBy | String | 更新者 | 是 |
| updateTime | Date | 更新时间 | 是 |
| remark | String | 备注 | 是 |
| params | Map<String, Object> | 请求参数 | 否 `@TableField(exist = false)` |

### 1.2 两种实体风格

**风格A: Lombok注解式（业务模块统一使用）**
```java
@EqualsAndHashCode(callSuper = true)
@Data
public class AlertSetting extends BaseEntity {
    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.AUTO)
    private Integer alertId;

    private Integer projectId;

    @TableField(exist = false)
    private String projectName;
}
```
适用模块: alert, device, packaging, project, report, stock-transfer, warehouse

**风格B: 手写getter/setter式（system/quartz老代码）**
```java
public class SysConfig extends BaseEntity {
    private Long configId;
    public Long getConfigId() { return configId; }
    public void setConfigId(Long configId) { this.configId = configId; }
}
```
适用模块: system, quartz

**风格C: 纯POJO关联表（不继承BaseEntity）**
```java
public class SysRoleDept {
    private Long roleId;
    private Long deptId;
}
```
适用: 中间关联表（sys_role_dept, sys_role_menu, sys_user_post, sys_user_role）

### 1.3 注解使用规范

| 注解 | 用途 | 示例 |
|------|------|------|
| `@TableId(type = IdType.AUTO)` | 自增主键 | 几乎所有实体 |
| `@TableId(type = IdType.INPUT)` | 手动输入主键 | 仅ProjectDatasource |
| `@TableField(exist = false)` | 非数据库字段 | 联表查询返回值 |
| `@TableName("xxx")` | 显式表名映射 | 类名与表名不一致时 |
| `@JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")` | 日期格式化 | 所有Date字段 |
| `@Schema(hidden = true)` | Swagger隐藏 | 审计字段 |
| `@Excel` | 导出注解 | 需要导出的字段 |

**显式表名映射场景**: 当Java类名与数据库表名不一致时必须使用
```java
@TableName("packaging_io_batch_record")
public class TransferBatch extends BaseEntity { ... }
```

---

## 2. Mapper层规范

### 2.1 三种Mapper模式

**模式A: 纯BaseMapper继承（简单CRUD，无自定义XML）**
```java
public interface XxxMapper extends BaseMapper<Xxx> {}
```
适用: AlertTypeMapper, SmartDeviceModelMapper, PackagingCategoryMapper, ProjectMapper, ProjectDatasourceMapper, CarrierMapper, InventoryBillChangeApplyMapper, IoTransferTypeMapper, TransferBatchHistoryMapper, TransferBatchPackagingHistoryMapper

**模式B: BaseMapper继承 + 自定义方法（有XML）**
```java
public interface XxxMapper extends BaseMapper<Xxx> {
    Page<Xxx> selectXxxList(Page<Xxx> page, Xxx xxx, Set<Integer> projectIds);
}
```
适用: AlertSettingMapper, PackagingDeviceRelationshipMapper, PackagingModelMapper, ProjectUserMapper, ProjectWarehousePackagingModelMapper, DailyStockMapper, InventoryBillMapper, InventoryDetailMapper, InventoryPlanMapper, TransferBatchMapper, TransferBatchPackagingMapper, WarehouseMapper, ApWarehouseRelationshipMapper, UserWarehouseMapper

**模式C: 不继承BaseMapper（纯XML驱动）**
```java
public interface XxxMapper {
    Page<Xxx> selectXxxList(Page<Xxx> page, Xxx xxx);
    int insertXxx(Xxx xxx);
    int updateXxx(Xxx xxx);
    int deleteXxxById(Long id);
}
```
适用: SysDeptMapper, SysMenuMapper, SysUserMapper, SysRoleMapper, SysConfigMapper, SysDictDataMapper, SysDictTypeMapper, SysLogininforMapper, SysNoticeMapper, SysOperLogMapper, SysPostMapper, SysRoleDeptMapper, SysRoleMenuMapper, SysUserPostMapper, SysUserRoleMapper, SysJobMapper, SysJobLogMapper, BasicDataMapper, IoRecordMapper, IoVarianceMapper, SmartDeviceMessageRecordMapper

### 2.2 方法命名规范

| 方法类型 | 命名规范 | 示例 |
|----------|----------|------|
| 列表查询 | selectXxxList | selectAlertSettingList |
| 详情查询 | selectXxxById | selectUserById |
| 单条查询 | selectXxx | selectConfig |
| 新增 | insertXxx | insertUser |
| 修改 | updateXxx | updateUser |
| 删除 | deleteXxxById | deleteUserById |
| 批量删除 | deleteXxxByIds | deleteUserByIds |
| 批量新增 | batchXxx | batchUserRole |
| 绑定关联 | relateXxxYyy | relateUserWarehouse |

### 2.3 分页查询签名

```java
// 标准分页签名
Page<Entity> selectEntityList(Page<Entity> page, Entity entity, Set<Integer> projectIds);

// 带仓库权限的分页签名
Page<Entity> selectEntityList(Page<Entity> page, Entity entity, Set<Integer> projectIds, Set<Integer> warehouseIds);
```

### 2.4 权限参数规范

- `Set<Integer> projectIds` - 项目权限过滤
- `Set<Integer> warehouseIds` - 仓库/节点权限过滤
- 权限参数放在方法签名最后

### 2.5 特殊注解使用

```java
// 多参数时使用@Param
Page<SmartDeviceMessageRecord> selectSmartDeviceMessageRecordList(
    Page<SmartDeviceMessageRecord> page,
    @Param("smartDeviceMessageRecord") SmartDeviceMessageRecord smartDeviceMessageRecord,
    @Param("projectIds") Set<Integer> projectIds
);

// 绕过MyBatis-Plus全表更新拦截
@InterceptorIgnore(blockAttack = "true")
int batchUpdateSubsequentDailyStock(List<DailyStock> dailyStocks);
```

---

## 3. SQL-XML编写规范

### 3.1 文件结构

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper
        PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN"
        "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="com.xxx.mapper.XxxMapper">
    <!-- 1. resultMap定义 -->
    <!-- 2. sql片段定义 -->
    <!-- 3. select/insert/update/delete操作 -->
</mapper>
```

### 3.2 ResultMap定义

```xml
<resultMap type="Entity" id="EntityResult">
    <id     property="id"          column="id"          />
    <result property="fieldName"   column="field_name"  />
    <result property="createBy"    column="create_by"   />
    <result property="createTime"  column="create_time" />
</resultMap>
```

**使用场景**:
- 联表查询返回非实体字段时必须使用resultMap
- 简单单表查询可直接使用resultType（依赖驼峰映射）

**需要resultMap的模块**: ProjectUserMapper, PackagingModelMapper, ProjectWarehousePackagingModelMapper, InventoryBillMapper, InventoryPlanMapper, InventoryDetailMapper, InventoryChangeApplyDetailMapper, SysJobMapper, SysJobLogMapper, SysConfigMapper, SysDeptMapper, SysDictDataMapper, SysDictTypeMapper, SysLogininforMapper, SysMenuMapper, SysNoticeMapper, SysOperLogMapper, SysPostMapper, SysRoleMapper, SysRoleDeptMapper, SysRoleMenuMapper, SysUserMapper, SysUserPostMapper, SysUserRoleMapper

### 3.3 SQL片段复用

```xml
<sql id="selectXxxVo">
    select id, field_name, create_by, create_time
    from table_name
</sql>

<select id="selectXxxById" resultMap="XxxResult">
    <include refid="selectXxxVo"/>
    where id = #{id}
</select>

<select id="selectXxxList" resultMap="XxxResult">
    <include refid="selectXxxVo"/>
    <where>...</where>
</select>
```

**使用场景**: 多个查询语句共用相同的SELECT字段列表

### 3.4 条件查询模式

**标准动态条件查询**:
```xml
<select id="selectXxxList" resultType="Xxx">
    SELECT * FROM table_name
    <where>
        <!-- 精确匹配 -->
        <if test="xxx.field != null">AND field = #{xxx.field}</if>

        <!-- 字符串非空判断 -->
        <if test="xxx.name != null and xxx.name != ''">AND name = #{xxx.name}</if>

        <!-- 模糊查询 -->
        <if test="xxx.name != null and xxx.name != ''">AND name LIKE CONCAT('%', #{xxx.name}, '%')</if>

        <!-- 时间范围查询（通过params Map传参） -->
        <if test="xxx.params.beginTime != null and xxx.params.beginTime != ''">
            AND create_time >= #{xxx.params.beginTime}
        </if>
        <if test="xxx.params.endTime != null and xxx.params.endTime != ''">
            AND create_time &lt;= #{xxx.params.endTime}
        </if>

        <!-- IN查询（权限过滤） -->
        <if test="projectIds != null">AND project_id IN
            <foreach collection="projectIds" item="projectId" index="index"
                     open="(" separator="," close=")">#{projectId}</foreach>
        </if>
    </where>
    ORDER BY id DESC
</select>
```

### 3.5 条件判断规范

| 数据类型 | 判断条件 | 示例 |
|----------|----------|------|
| String | `!= null and != ''` | `xxx.name != null and xxx.name != ''` |
| Integer/Long | `!= null` | `xxx.status != null` |
| Integer(含0判断) | `!= null and != 0` | `xxx.projectId != null and xxx.projectId != 0` |
| Date | `!= null` | `xxx.createTime != null` |
| Set/List | `!= null` | `projectIds != null` |
| 数组 | `!= null and length > 0` | `xxx.ids != null and xxx.ids.length > 0` |

### 3.6 XML特殊字符转义

| 符号 | XML转义 | 使用场景 |
|------|---------|----------|
| `<` | `&lt;` | `<=` 写成 `&lt;=` |
| `>` | `>` | `>=` 直接使用 |
| `&` | `&amp;` | 少见 |

### 3.7 联表查询模式

**LEFT JOIN关联查询**:
```xml
SELECT t.id, t.field, p.project_name, w.warehouse_abbreviation
FROM main_table t
LEFT JOIN project p ON p.project_id = t.project_id
LEFT JOIN warehouse w ON w.warehouse_id = t.warehouse_id
```

**条件JOIN**:
```xml
<if test="xxx.packagingModelId != null">
    INNER JOIN detail_table d ON d.main_id = t.id
        AND d.model_id = #{xxx.packagingModelId}
        AND d.status = 1
</if>
```

**Self-JOIN**:
```xml
LEFT JOIN same_table t2 ON t2.parent_id = t.id
    AND t2.create_time &lt; t.create_time
```

### 3.8 批量插入模式

**普通批量插入**:
```xml
<insert id="insertXxxList" parameterType="java.util.List">
    INSERT INTO table_name (field1, field2, create_by)
    VALUES
    <foreach collection="list" item="item" separator=",">
        (#{item.field1}, #{item.field2}, #{item.createBy})
    </foreach>
</insert>
```

**INSERT IGNORE批量插入（防重复）**:
```xml
<insert id="insertXxxList" parameterType="java.util.List">
    INSERT IGNORE INTO table_name (field1, field2)
    VALUES
    <foreach collection="list" item="item" separator=",">
        (#{item.field1}, #{item.field2})
    </foreach>
</insert>
```

### 3.9 UPSERT模式（INSERT ON DUPLICATE KEY UPDATE）

```xml
<insert id="processXxxList" parameterType="java.util.List">
    INSERT INTO table_name (unique_key, field1, field2)
    VALUES
    <foreach collection="list" item="item" separator=",">
        (#{item.uniqueKey}, #{item.field1}, #{item.field2})
    </foreach>
    ON DUPLICATE KEY UPDATE
    field1 = VALUES(field1),
    field2 = VALUES(field2)
</insert>
```

**使用场景**: 设备消息处理、个体状态更新、绑定关系维护

### 3.10 批量更新模式

**foreach多条UPDATE**:
```xml
<update id="updateXxxList">
    <foreach collection="list" item="item" separator=";">
        UPDATE table_name
        SET field1 = #{item.field1}, update_time = NOW()
        WHERE id = #{item.id}
    </foreach>
</update>
```

**高级批量更新（INNER JOIN子查询）**:
```xml
<update id="batchUpdateXxx">
    UPDATE target_table t
    INNER JOIN (
        SELECT t_inner.id, COALESCE(SUM(tmp.amount), 0) AS adjustment
        FROM target_table t_inner
        INNER JOIN (
            <foreach collection="list" item="item" separator="UNION ALL">
                SELECT #{item.id} AS id, #{item.amount} AS amount
            </foreach>
        ) tmp ON t_inner.id = tmp.id
        GROUP BY t_inner.id
    ) adj ON t.id = adj.id
    SET t.stock = t.stock + adj.adjustment
    WHERE adj.adjustment != 0
</update>
```

### 3.11 动态INSERT/UPDATE

**条件性列插入**:
```xml
<insert id="insertXxx" useGeneratedKeys="true" keyProperty="id">
    INSERT INTO table_name(
        <if test="id != null and id != 0">id,</if>
        <if test="name != null and name != ''">name,</if>
        create_time
    ) VALUES (
        <if test="id != null and id != 0">#{id},</if>
        <if test="name != null and name != ''">#{name},</if>
        sysdate()
    )
</insert>
```

**动态SET更新**:
```xml
<update id="updateXxx">
    UPDATE table_name
    <set>
        <if test="name != null">name = #{name},</if>
        <if test="status != null">status = #{status},</if>
        update_time = sysdate()
    </set>
    WHERE id = #{id}
</update>
```

### 3.12 权限过滤模式

**项目权限**:
```xml
<if test="projectIds != null">AND project_id IN
    <foreach collection="projectIds" item="projectId" open="(" separator="," close=")">#{projectId}</foreach>
</if>
```

**仓库权限**:
```xml
<if test="warehouseIds != null">AND warehouse_id IN
    <foreach collection="warehouseIds" item="warehouseId" open="(" separator="," close=")">#{warehouseId}</foreach>
</if>
```

**方向敏感的节点权限**（出入库场景）:
```xml
<if test="warehouseIds != null">
    AND (
        (io_type = 1 AND in_warehouse_id IN
            <foreach collection="warehouseIds" item="wId" open="(" separator="," close=")">#{wId}</foreach>)
        OR
        (io_type = 2 AND out_warehouse_id IN
            <foreach collection="warehouseIds" item="wId" open="(" separator="," close=")">#{wId}</foreach>)
    )
</if>
```

### 3.13 反向过滤模式

**查找未关联数据**:
```xml
<!-- LEFT JOIN + IS NULL -->
LEFT JOIN related_table r ON r.main_id = t.id
WHERE r.id IS NULL

<!-- NOT IN -->
WHERE id NOT IN (SELECT main_id FROM related_table)

<!-- LEFT JOIN + 条件 -->
LEFT JOIN other_table o ON o.bill_no = t.bill_no AND o.status = 1
WHERE o.id IS NULL  -- 没有配对的记录
```

### 3.14 排序规范

```xml
ORDER BY create_time DESC
ORDER BY project_id DESC, warehouse_id DESC, id DESC
ORDER BY field1 DESC, field2 ASC
```

---

## 4. 高级SQL技巧

### 4.1 窗口函数（MySQL 8.0+）

**ROW_NUMBER取最新快照**:
```xml
SELECT * FROM (
    SELECT *, ROW_NUMBER() OVER (
        PARTITION BY warehouse_id, model_id, type
        ORDER BY stock_date DESC
    ) AS rn
    FROM daily_stock
) t WHERE rn = 1
```

### 4.2 CTE公用表表达式（MySQL 8.0+）

```xml
WITH base_data AS (
    SELECT ... FROM table1
),
merged_data AS (
    SELECT ... FROM base_data
),
final_result AS (
    SELECT ... FROM merged_data
    UNION ALL
    SELECT ... FROM merged_data
)
SELECT * FROM final_result
```

### 4.3 LEFT JOIN LATERAL（MySQL 8.0+）

```xml
LEFT JOIN LATERAL (
    SELECT * FROM detail_table d
    WHERE d.main_id = t.id AND d.date &lt;= #{targetDate}
    ORDER BY d.date DESC
    LIMIT 1
) latest ON TRUE
```

### 4.4 CROSS JOIN生成维度

```xml
CROSS JOIN (
    SELECT 0 AS type
    UNION ALL
    SELECT 1 AS type
) types
```

### 4.5 CASE WHEN条件聚合

```xml
SUM(CASE
    WHEN io_type = 1 THEN io_count
    WHEN io_type = 2 THEN -io_count
    ELSE 0
END) AS net_count
```

### 4.6 三段式库存计算

```xml
-- 1. 前日快照
LEFT JOIN (
    SELECT ... FROM daily_stock WHERE stock_date &lt; DATE(#{time})
) snapshot USING (key)

-- 2. 当日增量
LEFT JOIN (
    SELECT ... FROM io_detail WHERE io_time BETWEEN DATE(#{time}) AND #{time}
) incr USING (key)

-- 3. 当日调整
LEFT JOIN (
    SELECT ... FROM adjust_detail WHERE adjust_time BETWEEN DATE(#{time}) AND #{time}
) adjust USING (key)

-- 最终: IFNULL(snapshot.stock, 0) + IFNULL(incr.change, 0) + IFNULL(adjust.count, 0)
```

### 4.7 其他SQL函数

| 函数 | 用途 | 示例 |
|------|------|------|
| `IFNULL(a, b)` | 空值处理 | `IFNULL(stock, 0)` |
| `COALESCE(a, b, c)` | 多值空值处理 | `COALESCE(SUM(amount), 0)` |
| `IF(cond, a, b)` | 条件表达式 | `IF(status IS NULL, 0, 1)` |
| `CONCAT('%', #{val}, '%')` | 模糊查询拼接 | LIKE查询 |
| `ROUND(val, n)` | 四舍五入 | 经纬度精度控制 |
| `TIMESTAMPDIFF(unit, t1, t2)` | 时间差计算 | 停留天数 |
| `NOW()` | 当前时间 | update_time |
| `sysdate()` | 当前时间 | system模块使用 |
| `DATE(val)` | 提取日期部分 | 时间范围比较 |
| `date_format(val, fmt)` | 日期格式化 | 按日比较 |

---

## 5. 约束边界

### 5.1 禁止事项

1. **禁止** `${}` 拼接SQL (除 DataScope 注入外)
2. **禁止**在XML中编写过于复杂的业务逻辑（超过200行需拆分）
3. **禁止**在Entity中定义与数据库无关的业务方法
4. **禁止**在XML中硬编码状态值（应使用参数传递）
5. **禁止**在循环中执行数据库操作
6. `<where>` 标签自动去除前导 AND/OR
7. `<if>` 条件中 `and` 用 `&amp;` 转义
8. `<foreach>` 批量操作使用 `separator=","`
9. 列表查询默认 `ORDER BY {主键} DESC`
10. 联表查询使用别名 `a`, `b`, `c`

### 5.1.1 DataScope 数据权限过滤 (系统模块专用)

> DataScope 是 RuoYi 框架的数据权限机制，通过 AOP 切面 + `${}` 字符串替换实现 SQL 级别的数据过滤。
> **本项目业务模块统一使用 `Set<Integer> projectIds` 做权限过滤，不使用 DataScope。DataScope 仅用于 system 模块的部门/角色/用户查询。**

#### 5.1.2 执行链路

```
@DataScope(deptAlias="d", userAlias="u")  ← 注解标注在 Service 方法上
        ↓
DataScopeAspect (AOP @Before 拦截)
        ↓
clearDataScope() → 先清空 params["dataScope"] = "" (防注入)
        ↓
dataScopeFilter() → 遍历用户角色，拼接 SQL 片段
        ↓
baseEntity.getParams().put("dataScope", " AND (d.dept_id = 100)")
        ↓
MyBatis XML: ${sysUser.params.dataScope} → 字符串替换到 WHERE 子句
```

#### 5.1.3 @DataScope 注解参数

| 参数 | 含义 | 示例 |
|------|------|------|
| `deptAlias` | SQL 中 `sys_dept` 表的别名 | `"d"` |
| `userAlias` | SQL 中 `sys_user` 表的别名 (仅策略"5"需要) | `"u"` |
| `permission` | 权限字符 (可选，默认从 @PreAuthorize 获取) | `"system:user:list"` |

#### 5.1.3 五种数据权限策略

| 策略 | dataScope值 | 生成的SQL片段 |
|------|-------------|---------------|
| 全部数据 | `"1"` | 不生成条件 (管理员直接跳过) |
| 自定义 | `"2"` | `AND (d.dept_id IN (SELECT dept_id FROM sys_role_dept WHERE role_id = 5))` |
| 本部门 | `"3"` | `AND (d.dept_id = 100)` |
| 本部门及以下 | `"4"` | `AND (d.dept_id IN (SELECT dept_id FROM sys_dept WHERE dept_id = 100 OR find_in_set(100, ancestors)))` |
| 仅本人(有userAlias) | `"5"` | `AND (u.user_id = 1)` |
| 仅本人(无userAlias) | `"5"` | `AND (d.dept_id = 0)` (不返回数据) |

#### 5.1.4 多角色合并逻辑

- 多个角色的条件以 `OR` 连接，整体被 `AND (...)` 包裹 (取并集)
- `"1"` (全部数据) 最高优先级，一旦出现清空所有限制
- 同一策略类型去重 (自定义策略除外)
- 所有角色权限字符都不匹配 → `dept_id = 0` (不返回数据)

#### 5.1.5 XML 中的使用方式

```xml
<!-- 参数无 @Param 时 (直接传 Entity) -->
${params.dataScope}

<!-- 参数有 @Param("sysUser") 时 -->
${sysUser.params.dataScope}

<!-- 参数有 @Param("user") 时 -->
${user.params.dataScope}
```

**拼接位置**: 放在 `WHERE` 子句最后、`ORDER BY` 之前。

```xml
<select id="selectUserList" parameterType="SysUser" resultMap="SysUserResult">
    SELECT u.user_id, u.user_name, d.dept_name
    FROM sys_user u
    LEFT JOIN sys_dept d ON u.dept_id = d.dept_id
    WHERE u.del_flag = '0'
    <if test="user.userName != null and user.userName != ''">
        AND u.user_name LIKE CONCAT('%', #{user.userName}, '%')
    </if>
    <!-- 数据范围过滤 (放在WHERE最后、ORDER BY之前) -->
    ${sysUser.params.dataScope}
    ORDER BY u.user_id
</select>
```

#### 5.1.6 Service 层使用

```java
@Service
public class SysUserServiceImpl {

    @DataScope(deptAlias = "d", userAlias = "u")
    public Page<SysUser> selectUserList(Page<SysUser> page, SysUser user) {
        return userMapper.selectUserList(page, user);
    }
}
```

#### 5.1.7 ${} 安全性说明

`${}` 是 MyBatis 的字符串替换 (非预编译)，通常存在 SQL 注入风险。但 DataScope 机制安全：
1. SQL 片段由服务端 AOP 切面生成，不包含用户输入
2. `clearDataScope()` 先清空 `params["dataScope"]`，防止前端通过请求参数注入
3. 管理员 (`isAdmin()=true`) 直接跳过，不拼接任何条件

### 5.1.8 项目实际 XML 示例 (WarehouseMapper.xml)

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN"
        "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="com.chentong.warehouse.mapper.WarehouseMapper">

    <select id="selectWarehouseListByProjectPermission"
            resultType="com.chentong.warehouse.domain.Warehouse">
        SELECT wh.warehouse_id, p.project_id, p.project_name,
               wh.warehouse_name, wh.warehouse_abbreviation,
               wh.longitude, wh.latitude, wh.radius,
               wh.address, wh.auto_io_type,
               wh.warehouse_status, wh.remark
        FROM warehouse wh
        LEFT JOIN project p ON p.project_id = wh.project_id
        WHERE p.project_status = 1
        <if test="warehouse.projectId != null">
            AND wh.project_id = #{warehouse.projectId}
        </if>
        <if test="warehouse.warehouseName != null and warehouse.warehouseName != ''">
            AND wh.warehouse_name LIKE CONCAT('%', #{warehouse.warehouseName}, '%')
        </if>
        <if test="warehouse.warehouseStatus != null">
            AND wh.warehouse_status = #{warehouse.warehouseStatus}
        </if>
        <if test="projectIds != null">
            AND wh.project_id IN
            <foreach collection="projectIds" item="projectId" index="index"
                     open="(" separator="," close=")">
                #{projectId}
            </foreach>
        </if>
        ORDER BY wh.project_id DESC, wh.warehouse_status DESC, wh.warehouse_id DESC
    </select>

</mapper>
```

**要点**:
- 使用 `resultType` 而非 `resultMap`，依赖 MyBatis 自动驼峰映射
- `LEFT JOIN project` 联表查询，`p.project_name` 自动映射到 Entity 的 `@TableField(exist = false) projectName`
- `Set<Integer> projectIds` 通过 `@Param` 传入，`<foreach>` 实现 IN 过滤
- 本项目业务模块**不使用** `${params.dataScope}`，统一用 `projectIds` 做权限过滤

---

### 5.2 性能约束

1. 单次查询返回数据量不超过10000条
2. 批量操作单次处理不超过1000条
3. 复杂联表查询必须有索引支持
4. 批量删除使用LIMIT分批执行
5. 全表更新需使用`@InterceptorIgnore(blockAttack = "true")`

### 5.3 命名约束

| 类型 | 规范 | 示例 |
|------|------|------|
| 表名 | 小写下划线 | `alert_setting` |
| 字段名 | 小写下划线 | `create_time` |
| Entity属性 | 驼峰命名 | `createTime` |
| Mapper方法 | 驼峰命名，动词开头 | `selectList` |
| XML id | 与方法名一致 | `selectXxxList` |
| ResultMap id | Entity名+Result | `XxxResult` |
| SQL片段id | selectXxxVo | `selectJobVo` |

### 5.4 注释约束

1. Mapper接口方法必须添加JavaDoc注释
2. XML中复杂SQL（超过20行）必须添加注释
3. ResultMap中非标准映射必须添加注释
4. 特殊SQL技巧需说明原因

### 5.5 事务约束

1. 涉及多表写操作必须使用`@Transactional`
2. 批量操作建议使用事务包裹
3. 关键业务操作必须记录操作日志
4. 删除操作必须有确认机制或软删除

### 5.6 Mapper选择约束

| 场景 | 选择 |
|------|------|
| 简单CRUD，无自定义查询 | 模式A: 纯BaseMapper |
| 有复杂查询，需要XML | 模式B: BaseMapper + 自定义方法 |
| 不需要MP功能，纯XML控制 | 模式C: 不继承BaseMapper |
| 老代码维护 | 保持原有模式，不强制迁移 |

---

## 6. 最佳实践

### 6.1 查询优化

1. 优先使用`<where>`标签而非手动编写WHERE 1=1
2. 合理使用`<sql>`片段减少重复代码
3. 联表查询使用表别名简化代码
4. 分页查询使用MyBatis-Plus的Page对象
5. 大数据量查询添加LIMIT限制

### 6.2 代码复用

1. 公共字段提取到`<sql>`片段
2. 权限条件提取为公共方法
3. 通用CRUD操作继承BaseMapper
4. ResultMap可在多个查询中复用

### 6.3 安全规范

1. 所有用户输入必须使用`#{}`参数化
2. 敏感字段查询需要权限验证
3. 删除操作必须有确认机制
4. 批量操作需要限制数量

### 6.4 项目特有约定

1. 时间范围通过`entity.params.beginTime`和`entity.params.endTime`传递
2. 权限过滤统一使用`Set<Integer>`类型
3. 联表查询返回的非数据库字段使用`@TableField(exist = false)`标记
4. 业务模块统一使用Lombok `@Data`注解
