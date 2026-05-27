---
name: tables-generator
description: 根据业务需求生成符合CTLMS项目规范的MySQL建表SQL、MyBatis-Plus Entity、Mapper接口及XML文件。严格遵循项目命名规范、字段约定和索引策略。
---

# 数据库表结构生成器 (tables-generator)

---

## 一、使用方式

用户提供以下信息，即可生成完整输出：

1. **表名** (英文，小写下划线)
2. **业务描述** (中文，用于 COMMENT)
3. **核心字段列表** (字段名、类型、说明)
4. **关联关系** (外键、关联表)

**输出物**：
- 建表 DDL SQL
- MyBatis-Plus Entity Java 类
- Mapper 接口 Java 类
- Mapper XML 文件
- 以上代码均符合项目规范，包含必要注释和索引设计
---

## 二、项目数据库规范 (必须严格遵守)

### 2.1 表名规范

| 规则 | 说明 | 示例 |
|------|------|------|
| 命名 | 全小写，单词间下划线分隔 | `packaging_io_batch_record` |
| 前缀 | 业务模块前缀 | `packaging_`, `inventory_`, `alert_` |
| 关联表 | 两实体名用下划线连接 | `project_user`, `user_warehouse` |
| 历史表 | 原表名 + `_history` | `packaging_io_batch_record_history` |
| 明细表 | 主表名 + `_detail` | `inventory_detail`, `packaging_io_batch_detail` |

**禁止**：
- 禁止使用驼峰命名
- 禁止使用 `sys_` 前缀 (系统表专用)
- 禁止使用复数形式 (如 `users`)

### 2.2 字段命名规范

| 规则 | 说明 | 示例 |
|------|------|------|
| 命名 | 全小写，下划线分隔 | `warehouse_id`, `create_time` |
| 主键 | `{表名简称}_id` | `batch_id`, `bill_id`, `plan_id` |
| 外键 | 与关联表主键同名 | `project_id`, `warehouse_id` |
| 状态字段 | `{实体}_status` | `alert_status`, `plan_status` |
| 时间字段 | `{动作}_time` | `create_time`, `io_time`, `submit_time` |
| 人字段 | `{动作}_by` | `create_by`, `update_by`, `submit_by` |
| 名称字段 | `{实体}_name` | `warehouse_name`, `carrier_name` |
| 编号字段 | `{实体}_no` | `bill_no`, `plan_no`, `model_no` |

### 2.3 公共字段 (几乎每张表必有)

```sql
`remark` varchar(200) DEFAULT NULL COMMENT '备注',
`create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
`create_by` varchar(50) DEFAULT NULL COMMENT '创建人',
`update_time` datetime DEFAULT NULL COMMENT '更新时间',
`update_by` varchar(50) DEFAULT NULL COMMENT '更新人'
```

**特殊表额外字段**：
- 需要乐观锁的表：`version` int DEFAULT '1' COMMENT '版本号'
- 软删除的表：`status` int DEFAULT '1' COMMENT '状态：0:无效 1:有效'
- RuoYi系统表：`create_by` varchar(64) DEFAULT '', `create_time` datetime DEFAULT NULL

### 2.4 字段类型映射

| 业务含义 | MySQL类型 | Java类型 | 说明 |
|----------|-----------|----------|------|
| 主键ID | `bigint NOT NULL AUTO_INCREMENT` | `Long` | 自增主键 |
| 绑定ID | `int NOT NULL AUTO_INCREMENT` | `Integer` | 关联表主键 |
| 外键ID | `int NOT NULL` / `bigint NOT NULL` | `Integer` / `Long` | 与被引用表主键类型一致 |
| 状态标志 | `int DEFAULT '1'` 或 `tinyint DEFAULT '0'` | `Integer` | 注释写明各值含义 |
| 名称 | `varchar(50) NOT NULL` | `String` | 业务名称 |
| 编号 | `varchar(50) NOT NULL` / `DEFAULT NULL` | `String` | 唯一编号 |
| 长文本 | `text` / `varchar(500)` | `String` | 视长度选择 |
| 数量 | `int NOT NULL` / `DEFAULT '0'` | `Integer` | 计数字段 |
| 金额/阈值 | `decimal(8,1)` / `decimal(10,4)` | `BigDecimal` | 指定精度 |
| 经纬度 | `decimal(10,6)` | `BigDecimal` | 6位小数 |
| 温度 | `decimal(6,2)` | `BigDecimal` | 2位小数 |
| 日期 | `date` | `Date` | 仅日期 |
| 时间 | `datetime` | `Date` | 日期+时间 |
| 布尔 | `tinyint(1)` | `Boolean` | 0/1 |
| 附件URL | `varchar(150)` | `String` | 文件地址 |
| 备注 | `varchar(200)` / `varchar(500)` | `String` | 通用备注 |

### 2.5 索引规范

```sql
-- 主键 (必须)
PRIMARY KEY (`xxx_id`)

-- 唯一索引 (业务唯一约束)
UNIQUE KEY `unique_xxx_yyy` (`xxx`, `yyy`)

-- 普通索引 (高频查询字段)
KEY `idx_xxx` (`xxx`)
KEY `idx_xxx_yyy` (`xxx`, `yyy`)

-- 复合索引 (多条件查询，注意最左前缀)
KEY `idx_status_project_time` (`status`, `project_id`, `create_time`)
```

**索引命名规则**：
- 唯一索引：`unique_{字段1}_{字段2}`
- 普通索引：`idx_{字段1}_{字段2}`

**索引策略**：
- 外键字段必须建索引
- 高频 WHERE 条件字段建索引
- 状态字段 + 业务字段组合索引
- 避免在低区分度字段(如 `sex`)上单独建索引

### 2.6 建表模板

```sql
DROP TABLE IF EXISTS `{table_name}`;
CREATE TABLE `{table_name}` (
  `{primary_key}` bigint NOT NULL AUTO_INCREMENT COMMENT '{主键说明}',
  -- 业务字段...
  `status` int DEFAULT '1' COMMENT '状态（0停止 1正常）',
  `remark` varchar(200) DEFAULT NULL COMMENT '备注',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `create_by` varchar(50) DEFAULT NULL COMMENT '创建人',
  `update_time` datetime DEFAULT NULL COMMENT '更新时间',
  `update_by` varchar(50) DEFAULT NULL COMMENT '更新人',
  PRIMARY KEY (`{primary_key}`),
  -- 索引...
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='{表注释}';
```

### 2.7 分区表 (大数据量)

#### 何时使用分区

| 场景 | 是否分区 | 说明 |
|------|----------|------|
| IoT消息记录表 (百万级以上) | **必须分区** | 如 `ap_tag_message_record`, `smart_device_message_record` |
| 出入库记录表 (持续增长) | **建议分区** | 如 `packaging_io_record` |
| 操作日志、登录日志 | **建议分区** | 如 `sys_oper_log`, `sys_logininfor` |
| 配置表、字典表 | 不分区 | 数据量小，无需分区 |
| 主从表、明细表 | 不分区 | 数据量通常可控 |

#### 分区键选择

- **必须**选择 `datetime` 或 `date` 类型的时间字段作为分区键
- **优先**选择查询条件中最常出现的时间字段 (如 `acquisition_time`, `io_time`)
- 分区键字段**必须**包含在主键中 (MySQL 分区表限制)

#### `to_days()` 值计算

`to_days()` 将日期转换为从公元0年1月1日起的天数，用于 RANGE 分区的边界值：

| 日期 | to_days() 值 | 分区名 |
|------|-------------|--------|
| 2024-01-01 | 739617 | p2024 |
| 2025-01-01 | 739982 | p2025 |
| 2026-01-01 | 740347 | p2026 |
| 2027-01-01 | 740712 | p2027 |

**计算公式**: `to_days('YYYY-MM-DD')` 可在 MySQL 中直接执行得到。

#### 完整建表模板

```sql
DROP TABLE IF EXISTS `{table_name}`;
CREATE TABLE `{table_name}` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  -- 业务字段...
  `acquisition_time` datetime NOT NULL COMMENT '采集时间',
  -- 公共字段...
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `create_by` varchar(50) DEFAULT NULL COMMENT '创建人',
  `update_time` datetime DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (`id`, `acquisition_time`),  -- 分区键必须包含在主键中
  UNIQUE KEY `uk_xxx_time` (`xxx_no`, `acquisition_time`),
  KEY `idx_status_time` (`process_status`, `acquisition_time` DESC)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='{表注释}'
/*!50100 PARTITION BY RANGE (to_days(`acquisition_time`))
(PARTITION p2025 VALUES LESS THAN (739982) ENGINE = InnoDB,
 PARTITION p2026 VALUES LESS THAN (740347) ENGINE = InnoDB,
 PARTITION p2027 VALUES LESS THAN MAXVALUE ENGINE = InnoDB) */;
```

#### 关键约束

1. **主键必须包含分区键**: MySQL 要求分区表的主键/唯一索引必须包含分区键字段
2. **唯一索引同理**: `UNIQUE KEY` 也必须包含分区键，否则建表报错
3. **分区命名**: `p{年份}` 格式，如 `p2025`, `p2026`
4. **最后一个分区**: 使用 `MAXVALUE` 兜底，防止数据写入失败
5. **提前创建分区**: 每年年底前创建下一年的分区

#### 新增分区 (运维操作)

```sql
-- 在年底执行，为下一年添加分区
ALTER TABLE `{table_name}` REORGANIZE PARTITION p_future INTO (
    PARTITION p2027 VALUES LESS THAN (740712) ENGINE = InnoDB,
    PARTITION p_future VALUES LESS THAN MAXVALUE ENGINE = InnoDB
);
```

#### 项目实际案例

```sql
-- ap_tag_message_record 表的分区设计
-- 分区键: acquisition_time (采集时间，每条消息必有)
-- 主键: (id, acquisition_time) — 满足MySQL分区表主键约束
-- 分区: 按年分区，p2025/p2026/p2027+MAXVALUE

CREATE TABLE `ap_tag_message_record` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `device_no` varchar(50) NOT NULL COMMENT '设备编号',
  `acquisition_time` datetime NOT NULL COMMENT '采集时间',
  -- 其他字段...
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`,`acquisition_time`),
  UNIQUE KEY `uk_device_time` (`device_no`,`acquisition_time`),
  KEY `idx_status_time_project` (`process_status`,`acquisition_time` DESC,`project_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='网关-标签设备消息记录'
/*!50100 PARTITION BY RANGE (to_days(`acquisition_time`))
(PARTITION p2025 VALUES LESS THAN (739982) ENGINE = InnoDB,
 PARTITION p2026 VALUES LESS THAN (740347) ENGINE = InnoDB,
 PARTITION p2027 VALUES LESS THAN MAXVALUE ENGINE = InnoDB) */;
```

---

## 六、完整生成示例 

### 6.1 DDL

```sql
DROP TABLE IF EXISTS `warehouse`;
CREATE TABLE `warehouse` (
  `warehouse_id` int NOT NULL AUTO_INCREMENT COMMENT '仓库id',
  `project_id` int NOT NULL COMMENT '项目id',
  `warehouse_name` varchar(50) NOT NULL COMMENT '仓库名称',
  `warehouse_abbreviation` varchar(50) NOT NULL COMMENT '仓库简称',
  `longitude` decimal(10,6) DEFAULT NULL COMMENT '经度',
  `latitude` decimal(10,6) DEFAULT NULL COMMENT '纬度',
  `radius` int DEFAULT '0' COMMENT '电子围栏半径(米)',
  `address` varchar(400) NOT NULL COMMENT '仓库地址',
  `auto_io_type` int NOT NULL DEFAULT '0' COMMENT '自动出入库类型：0无、1自动入、2自动出、3自动出入',
  `warehouse_status` int DEFAULT '1' COMMENT '仓库状态（0停止 1正常）',
  `remark` varchar(200) DEFAULT NULL COMMENT '备注',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime DEFAULT NULL COMMENT '更新时间',
  `create_by` varchar(50) DEFAULT NULL COMMENT '创建人',
  `update_by` varchar(50) DEFAULT NULL COMMENT '更新人',
  PRIMARY KEY (`warehouse_id`),
  UNIQUE KEY `unique_project_warehouse` (`project_id`,`warehouse_name`)
) ENGINE=InnoDB AUTO_INCREMENT=133 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='仓库节点';
```

### 6.2 Entity 

```java
package com.chentong.warehouse.domain;

import java.math.BigDecimal;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import lombok.Data;
import com.chentong.common.annotation.Excel;
import com.chentong.common.core.domain.BaseEntity;
import lombok.EqualsAndHashCode;

@EqualsAndHashCode(callSuper = true)
@Data
public class Warehouse extends BaseEntity {

    private static final long serialVersionUID = 1L;

    @Excel(name = "节点id", width = 20)
    @TableId(type = IdType.AUTO)
    private Integer warehouseId;

    private Integer projectId;

    @Excel(name = "节点名称", width = 20)
    private String warehouseName;

    /** 项目名 -- 联表查询字段，非本表字段 */
    @Excel(name = "项目名称", width = 20)
    @TableField(exist = false)
    private String projectName;

    private String warehouseAbbreviation;

    @Excel(name = "经度", width = 20)
    private BigDecimal longitude;

    @Excel(name = "纬度", width = 20)
    private BigDecimal latitude;

    @Excel(name = "电子围栏半径(米)")
    private Long radius;

    @Excel(name = "节点地址", width = 20)
    private String address;

    @Excel(name = "自动出入库类型", readConverterExp = "0=关闭,1=自动入库,2=自动出库,3=自动出入库")
    private Integer autoIoType;

    @Excel(name = "节点备注", width = 20)
    private String remark;

    @Excel(name = "节点状态", readConverterExp = "0=关闭,1=正常")
    private Integer warehouseStatus;
}
```

**要点**:
- 继承 `BaseEntity`，自动获得 `createBy`, `createTime`, `updateBy`, `updateTime`, `remark`, `params` 字段
- `@TableId(type = IdType.AUTO)` 标记自增主键
- `@TableField(exist = false) projectName` 标记非本表字段，用于接收联表查询结果
- `@Excel` 注解用于 RuoYi 导出功能，`readConverterExp` 做值转换

### 6.3 Mapper 接口

```java
package com.chentong.warehouse.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.chentong.warehouse.domain.Warehouse;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Set;

public interface WarehouseMapper extends BaseMapper<Warehouse> {

    /** 联表分页查询 -- 对应XML中的SQL */
    Page<Warehouse> selectWarehouseListByProjectPermission(
        Page<Warehouse> page, Warehouse warehouse, Set<Integer> projectIds);

    /** 注解方式的简单查询 -- 无XML */
    @Select("SELECT warehouse_id, auto_io_type FROM warehouse WHERE warehouse_status = 1")
    List<Warehouse> selectValidWarehouseAutoIoType();
}
```

**要点**:
- 继承 `BaseMapper<Warehouse>` 获得基础 CRUD
- 联表查询方法对应 XML 中的 SQL
- 简单查询可直接用 `@Select` 注解，无需 XML
- `Set<Integer> projectIds` 是本项目的权限过滤标准参数

### 6.4 Mapper XML

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
- 使用 `resultType` 而非 `resultMap`，依赖 MyBatis 自动驼峰映射 (`warehouse_id` → `warehouseId`)
- `LEFT JOIN project` 联表查询，`p.project_name` 自动映射到 Entity 的 `projectName`
- `<if>` 动态条件过滤，`<foreach>` 实现 `IN` 权限过滤
- **不使用** `${params.dataScope}`，统一用 `projectIds` 做权限过滤

### 6.5 Service 接口 

```java
package com.chentong.warehouse.service;

import java.util.List;
import java.util.Set;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.IService;
import com.chentong.warehouse.domain.Warehouse;

public interface IWarehouseService extends IService<Warehouse> {

    Page<Warehouse> selectWarehouseListByProjectPermission(
        Page<Warehouse> page, Warehouse warehouse, Set<Integer> projectIds);

    List<Warehouse> selectValidWarehouseAutoIoType();
}
```

### 6.6 Service 实现

```java
package com.chentong.warehouse.service.impl;

import java.util.List;
import java.util.Set;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.chentong.common.utils.PageUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.chentong.warehouse.mapper.WarehouseMapper;
import com.chentong.warehouse.domain.Warehouse;
import com.chentong.warehouse.service.IWarehouseService;

@Service
public class WarehouseServiceImpl
    extends ServiceImpl<WarehouseMapper, Warehouse>
    implements IWarehouseService {

    @Autowired
    private WarehouseMapper warehouseMapper;

    @Override
    public Page<Warehouse> selectWarehouseListByProjectPermission(
        Page<Warehouse> page, Warehouse warehouse, Set<Integer> projectIds) {
        // 权限前置校验: projectIds 为空集合时直接返回空分页
        if (projectIds != null && projectIds.isEmpty()) {
            return PageUtils.emptyPage(page);
        }
        return warehouseMapper.selectWarehouseListByProjectPermission(
            page, warehouse, projectIds);
    }

    @Override
    public List<Warehouse> selectValidWarehouseAutoIoType() {
        return warehouseMapper.selectValidWarehouseAutoIoType();
    }
}
```

**要点**:
- 继承 `ServiceImpl<WarehouseMapper, Warehouse>` 获得 IService 默认实现
- 联表查询统一委托 Mapper XML，不在 Service 中使用 `LambdaQueryWrapper`
- `projectIds` 空集合时调用 `PageUtils.emptyPage(page)` 短路返回，避免无意义的 DB 查询
- 简单查询直接委托 Mapper，无额外逻辑

---

## 七、常见业务表类型模板

### 7.1 字典/配置表

```sql
-- 特点: 数据量小，有 status 控制启用停用
CREATE TABLE `{table_name}` (
  `{xxx}_id` int NOT NULL AUTO_INCREMENT COMMENT '{xxx}id',
  `{xxx}_name` varchar(30) NOT NULL COMMENT '{xxx}名',
  `{xxx}_status` int DEFAULT '1' COMMENT '{xxx}状态（0停止 1正常）',
  `remark` varchar(50) DEFAULT NULL COMMENT '备注',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `create_by` varchar(50) DEFAULT NULL COMMENT '创建人',
  `update_time` datetime DEFAULT NULL COMMENT '更新时间',
  `update_by` varchar(50) DEFAULT NULL COMMENT '更新人',
  PRIMARY KEY (`{xxx}_id`),
  UNIQUE KEY `unique_{xxx}_name` (`{xxx}_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='{xxx}表';
```

### 7.2 关联/绑定表

```sql
-- 特点: 两张表的外键联合唯一
CREATE TABLE `{table_name}` (
  `bind_id` int NOT NULL AUTO_INCREMENT COMMENT '绑定id',
  `project_id` int NOT NULL COMMENT '项目id',
  `{entity1}_id` int NOT NULL COMMENT '{实体1}id',
  `{entity2}_id` int NOT NULL COMMENT '{实体2}id',
  `status` int DEFAULT '1' COMMENT '状态（0停止 1正常）',
  `remark` varchar(200) DEFAULT NULL COMMENT '备注',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `create_by` varchar(50) DEFAULT NULL COMMENT '创建人',
  `update_time` datetime DEFAULT NULL COMMENT '更新时间',
  `update_by` varchar(50) DEFAULT NULL COMMENT '更新人',
  PRIMARY KEY (`bind_id`),
  UNIQUE KEY `idx_{entity1}_{entity2}` (`{entity1}_id`,`{entity2}_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='{xxx}关系表';
```

### 7.3 主从/明细表

```sql
-- 主表
CREATE TABLE `{master_table}` (
  `{master}_id` bigint NOT NULL AUTO_INCREMENT COMMENT '{主表}id',
  `{master}_no` varchar(50) DEFAULT NULL COMMENT '{主表}编号',
  `project_id` int NOT NULL COMMENT '项目id',
  -- 主表业务字段...
  `status` int DEFAULT '1' COMMENT '状态：0:无效 1:有效',
  `remark` varchar(200) DEFAULT NULL COMMENT '备注',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `create_by` varchar(50) DEFAULT NULL COMMENT '创建人',
  `update_time` datetime DEFAULT NULL COMMENT '更新时间',
  `update_by` varchar(50) DEFAULT NULL COMMENT '更新人',
  `version` int DEFAULT '1' COMMENT '版本号',
  PRIMARY KEY (`{master}_id`),
  UNIQUE KEY `unique_{master}_no` (`{master}_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='{主表}表';

-- 明细表
CREATE TABLE `{detail_table}` (
  `detail_id` bigint NOT NULL AUTO_INCREMENT COMMENT '明细id',
  `{master}_id` bigint NOT NULL COMMENT '{主表}id',
  -- 明细业务字段...
  `remark` varchar(200) DEFAULT NULL COMMENT '备注',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `create_by` varchar(50) DEFAULT NULL COMMENT '创建人',
  `update_time` datetime DEFAULT NULL COMMENT '更新时间',
  `update_by` varchar(50) DEFAULT NULL COMMENT '更新人',
  PRIMARY KEY (`detail_id`),
  KEY `idx_{master}_id` (`{master}_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='{明细表}表';
```

### 7.4 历史记录表

```sql
-- 结构与原表基本一致，增加 history_record_id 和 version
CREATE TABLE `{table_name}_history` (
  `history_record_id` bigint NOT NULL AUTO_INCREMENT COMMENT '历史记录id',
  `{原表所有字段...}`,
  `version` int NOT NULL COMMENT '版本号',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `create_by` varchar(50) DEFAULT NULL COMMENT '创建人',
  `update_time` datetime DEFAULT NULL COMMENT '更新时间',
  `update_by` varchar(50) DEFAULT NULL COMMENT '更新人',
  PRIMARY KEY (`history_record_id`),
  KEY `idx_{master}_id` (`{master}_id`),
  KEY `idx_version` (`version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='{原表}历史记录';
```

### 7.5 日报/快照表

```sql
-- 特点: 按日期记录，有唯一约束防止重复
CREATE TABLE `{table_name}` (
  `record_id` bigint NOT NULL AUTO_INCREMENT COMMENT '记录id',
  `project_id` int NOT NULL COMMENT '项目id',
  `warehouse_id` int NOT NULL COMMENT '仓库id',
  `xxx_date` date NOT NULL COMMENT '{xxx}日期',
  -- 业务字段...
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (`record_id`),
  UNIQUE KEY `unique_{维度字段组合}` (`warehouse_id`, `xxx_date`),
  KEY `idx_project_date` (`project_id`, `xxx_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='{xxx}表';
```

---

## 八、检查清单

生成完成后，逐项检查：

- [ ] 表名全小写+下划线，无驼峰
- [ ] 主键 `{xxx}_id` + `AUTO_INCREMENT`
- [ ] 类型为 `bigint` 或 `int` (与引用方一致)
- [ ] 公共字段 `create_time`, `create_by`, `update_time`, `update_by` 齐全
- [ ] 所有字段有 `COMMENT` 注释
- [ ] 引擎 `InnoDB`，字符集 `utf8mb4`，排序规则 `utf8mb4_0900_ai_ci`
- [ ] 唯一约束命名 `unique_xxx`
- [ ] 普通索引命名 `idx_xxx`
- [ ] 外键字段有索引
- [ ] Entity 字段与 DB 字段一一对应 (下划线转驼峰)
- [ ] Entity 继承 `BaseEntity`，有 `@TableName` 注解
- [ ] 主键有 `@TableId(type = IdType.AUTO)`
- [ ] 联表查询字段有 `@TableField(exist = false)`
- [ ] Mapper 继承 `BaseMapper<T>`
- [ ] XML namespace 正确
- [ ] XML resultMap 包含所有查询字段
- [ ] XML 中无 `${}` 拼接
- [ ] XML 中状态值未硬编码
