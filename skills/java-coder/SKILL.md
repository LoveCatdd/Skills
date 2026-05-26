---
name: java-coder
description: 基于企业级Java后端开发，提炼核心技术栈与设计模式，涵盖安全鉴权、权限控制、定时任务、IIOT消费队列、MyBatis-Plus ORM等模块的实战指南与代码示例。专注于JAVA后端代码编写
version: 1.0.0
author: LPXL
---

---

### 用法示例 (Triggers)

/java-coder 根据以下的架构以及编码风格模式，编写我需要的Java后端代码，要求代码必须包含完整的错误处理逻辑，并且在生成前先输出设计思路与核心组件说明。

---

## 1. Spring Security + JWT + Redis 鉴权体系

### 1.1 架构概览

```
请求 → CorsFilter → JwtAuthenticationTokenFilter → UsernamePasswordAuthenticationFilter → Controller
                           ↓
                    TokenService (从Header解析JWT)
                           ↓
                    RedisCache (根据UUID获取LoginUser)
                           ↓
                    SecurityContextHolder (设置Authentication)
```

### 1.2 核心组件

| 组件                             | 职责                                       |
| ------------------------------ | ---------------------------------------- |
| `SecurityConfig`               | 安全过滤链配置，CSRF禁用，Session无状态，URL白名单         |
| `JwtAuthenticationTokenFilter` | 继承，每次请求解析Token并恢复用户上下文 `OncePerRequestFilter` |
| `TokenService`                 | JWT创建/解析/刷新，Redis存储LoginUser，20分钟自动续期    |
| `SysLoginService`              | 登录入口：验证码校验 → IP黑名单 → AuthenticationManager认证 → 生成Token |
| `UserDetailsServiceImpl`       | 实现，查询数据库组装 `UserDetailsService``LoginUser` |

### 1.3 Token机制详解

```
┌──────────────────────────────────────────────────────────┐
│                    Token生命周期                           │
├──────────────────────────────────────────────────────────┤
│ 1. 登录时: UUID = IdUtils.fastUUID()                     │
│ 2. 存储: Redis Key = "login_tokens:" + UUID              │
│         Redis Value = LoginUser (含permissions, user)     │
│         TTL = expireTime分钟 (默认30分钟)                 │
│ 3. 签发: JWT claims = {LOGIN_USER_KEY: UUID}             │
│         算法 = HS512                                      │
│ 4. 请求时: Header = "Authorization: Bearer <token>"       │
│ 5. 解析: JWT → UUID → Redis → LoginUser                  │
│ 6. 续期: 距过期不足20分钟自动刷新Redis TTL                 │
└──────────────────────────────────────────────────────────┘
```

**关键设计点：**

- JWT本身**只存UUID**，不存用户数据，真正的用户信息在Redis
- 通过Redis实现**服务端可控的会话管理**（踢人下线只需删Redis Key）
- **滑动过期**：每次请求检测，不足20分钟自动续期

### 1.4 登录流程

```
// SysLoginService.login() 核心流程
1. validateCaptcha()    // Redis校验验证码
2. loginPreCheck()      // 用户名/密码长度校验 + IP黑名单
3. authenticationManager.authenticate()  // 委托给UserDetailsServiceImpl
4. AsyncManager → recordLogininfor()     // 异步记录登录日志
5. tokenService.createToken(loginUser)   // 生成JWT
```

### 1.5 用户上下文 (LoginUser)

```
public class LoginUser implements UserDetails {
    private Long userId;           // 用户ID
    private Long deptId;           // 部门ID
    private String token;          // UUID令牌标识
    private Long loginTime;        // 登录时间
    private Long expireTime;       // 过期时间
    private String ipaddr;         // 登录IP
    private Set<String> permissions; // 权限集合 (如 "system:user:list")
    private SysUser user;          // 完整用户实体
}
```

### 1.6 SecurityConfig 过滤链配置

```
httpSecurity
    .csrf().disable()                              // 禁用CSRF (无状态)
    .sessionManagement(STATELESS)                  // 无Session
    .exceptionHandling(authenticationEntryPoint)   // 认证失败处理
    .authorizeHttpRequests(requests -> {
        permitAllUrl.getUrls().forEach(url -> requests.requestMatchers(url).permitAll());
        requests.requestMatchers("/login", "/register", "/captchaImage").permitAll()
                .requestMatchers(GET, "/", "*.html", "*.css", "*.js").permitAll()
                .anyRequest().authenticated();
    })
    .addFilterBefore(authenticationTokenFilter, UsernamePasswordAuthenticationFilter.class)
    .addFilterBefore(corsFilter, JwtAuthenticationTokenFilter.class)
    .build();
```

---

---

## 2. RBAC角色权限控制模型

### 2.1 三层权限模型

```
┌─────────────────────────────────────────────────────────────────┐
│                      权限模型三层架构                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  第一层: 菜单权限 (Menu Permission)                               │
│  ├── 控制用户能看到哪些菜单、按钮                                   │
│  ├── 标识: "system:user:list", "system:user:add"                │
│  ├── 注解: @PreAuthorize("@ss.hasPermi('system:user:list')")    │
│  └── 数据源: sys_menu.permission + sys_role_menu                │
│                                                                 │
│  第二层: 角色权限 (Role Permission)                               │
│  ├── 控制用户属于哪些角色                                          │
│  ├── 标识: "admin", "common"                                    │
│  ├── 注解: @PreAuthorize("@ss.hasRole('admin')")                │
│  └── 数据源: sys_role + sys_user_role                           │
│                                                                 │
│  第三层: 数据权限 (Data Scope)                                    │
│  ├── 控制用户能看到哪些部门/自己的数据                                │
│  ├── 注解: @DataScope(deptAlias="d", userAlias="u")             │
│  ├── 5级: 全部/自定义/部门/部门及下级/仅本人                         │
│  └── 机制: AOP切面动态追加SQL WHERE条件                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 菜单权限 (PermissionService)

```
@Service("ss")  // Bean名 "ss"，用于SpEL表达式 @ss.hasPermi(...)
public class PermissionService {

    // 验证用户是否具备某权限
    public boolean hasPermi(String permission) {
        LoginUser loginUser = SecurityUtils.getLoginUser();
        Set<String> permissions = loginUser.getPermissions();
        return hasPermissions(permissions, permission);
    }

    // 验证用户是否具有某个角色
    public boolean hasRole(String role) {
        LoginUser loginUser = SecurityUtils.getLoginUser();
        for (SysRole sysRole : loginUser.getUser().getRoles()) {
            if ("admin".equals(roleKey) || roleKey.equals(role)) return true;
        }
        return false;
    }
}
```

**Controller使用方式：**

```
@PreAuthorize("@ss.hasPermi('system:user:list')")  // 菜单权限校验
@GetMapping("/list")
public TableDataInfo list(SysUser user) { ... }

@PreAuthorize("@ss.hasRole('admin')")               // 角色权限校验
@PreAuthorize("@ss.hasAnyPermi('a,b,c')")           // 任意一个权限即可
```

### 2.3 数据权限 (DataScopeAspect)

```
@Aspect
@Component
public class DataScopeAspect {

    // 5级数据权限
    public static final String DATA_SCOPE_ALL = "1";           // 全部数据
    public static final String DATA_SCOPE_CUSTOM = "2";        // 自定义(关联sys_role_dept)
    public static final String DATA_SCOPE_DEPT = "3";          // 本部门数据
    public static final String DATA_SCOPE_DEPT_AND_CHILD = "4"; // 本部门及下级
    public static final String DATA_SCOPE_SELF = "5";          // 仅本人数据

    @Before("@annotation(controllerDataScope)")
    public void doBefore(JoinPoint point, DataScope controllerDataScope) {
        // 获取当前用户角色，根据角色的dataScope字段动态拼接SQL
        // 结果注入到 BaseEntity.params.put("dataScope", sql片段)
    }
}
```

**原理：** AOP切面在Service方法执行前，根据当前用户角色的数据权限级别，向`BaseEntity.params`中注入SQL条件片段，在MyBatis XML中通过`${params.dataScope}`引用。

### 2.4 权限上下文 (ContextHolder)

```
// 认证上下文 - 在认证过程中传递AuthenticationToken
AuthenticationContextHolder.setContext(authenticationToken);
AuthenticationContextHolder.clearContext();

// 权限上下文 - 在权限校验过程中传递permission字符串
PermissionContextHolder.setContext(permission);
PermissionContextHolder.getContext();
```

**设计意义：** 使用实现请求级别的上下文传递，避免方法参数层层透传。 `ThreadLocal`

### 2.5 业务数据权限

```
// BusinessPermissionService - 项目级数据权限
// 通过项目-用户关系表控制用户可访问的项目数据
// 查询时传入 projectIds 集合，null代表全部权限，空集合代表无权限
public Page<ApTagMessageRecord> selectList(..., Set<Integer> projectIds) {
    if (projectIds != null && projectIds.isEmpty()) {
        return PageUtils.emptyPage(page);  // 无权限返回空
    }
    return mapper.selectList(page, record, projectIds);  // SQL中追加 project_id IN (...)
}
```

---

---

## 3. 定时任务 + 异步线程 + 日志

### 3.1 定时任务体系 (Quartz)

```
┌────────────────────────────────────────────────────────────────┐
│                      Quartz定时任务架构                          │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ScheduleUtils.createScheduleJob()                             │
│       ├── 构建JobDetail (JobBuilder)                           │
│       ├── 构建CronTrigger (CronScheduleBuilder)                │
│       ├── 处理Misfire策略 (默认/忽略/立即执行/放弃)               │
│       └── scheduler.scheduleJob(jobDetail, trigger)            │
│                                                                │
│  AbstractQuartzJob (模板方法模式)                                │
│       ├── before()   → ThreadLocal记录开始时间                  │
│       ├── doExecute() → 子类实现具体业务逻辑                     │
│       └── after()    → 计算耗时 + 记录SysJobLog到数据库          │
│                                                                │
│  并发控制:                                                      │
│       ├── QuartzJobExecution          → 允许并发                │
│       └── QuartzDisallowConcurrentExecution → 禁止并发          │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**AbstractQuartzJob关键设计：**

```
public abstract class AbstractQuartzJob implements Job {
    private static ThreadLocal<Date> threadLocal = new ThreadLocal<>();

    @Override
    public void execute(JobExecutionContext context) {
        SysJob sysJob = new SysJob();
        BeanUtils.copyBeanProp(sysJob, context.getMergedJobDataMap().get(TASK_PROPERTIES));
        try {
            before(context, sysJob);      // ThreadLocal记录开始时间
            doExecute(context, sysJob);   // 子类实现
            after(context, sysJob, null); // 正常结束记录日志
        } catch (Exception e) {
            after(context, sysJob, e);    // 异常结束记录日志
        }
    }

    protected void after(..., Exception e) {
        // 计算耗时，记录JobLog
        SpringUtils.getBean(ISysJobLogService.class).addJobLog(sysJobLog);
    }
}
```

### 3.2 具体任务示例 (SyncDataTask)

```
@Component("syncDataTask")
public class SyncDataTask {

    // 原子布尔 - 保证同一时刻只有一个同步线程
    private static final AtomicBoolean isSyncing = new AtomicBoolean(false);

    public void syncMessage(Integer projectId, String beginTime, String endTime) {
        // CAS获取锁
        if (!isSyncing.compareAndSet(false, true)) {
            logger.info("有进行中的同步任务");
            return;
        }
        try {
            // 1. JDBC连接外部数据源查询数据
            // 2. MyBatis BATCH模式批量插入 (batchSize = 5000)
            // 3. 异步调用数据清洗 → 数据处理
            AsyncManager.me().execute(() -> {
                service.cleanDeviceMessage(() -> {
                    AsyncManager.me().execute(() -> {
                        service.processDeviceMessage();  // 回调式链式异步
                    });
                });
            });
        } finally {
            isSyncing.set(false);  // 释放锁
        }
    }
}
```

### 3.3 异步任务管理器

```
// 单例模式 + ScheduledExecutorService
public class AsyncManager {
    private final int OPERATE_DELAY_TIME = 10;  // 延迟10ms执行
    private ScheduledExecutorService executor = SpringUtils.getBean("scheduledExecutorService");

    private static AsyncManager me = new AsyncManager();  // 饿汉单例
    public static AsyncManager me() { return me; }

    public void execute(Runnable task) {
        executor.schedule(task, OPERATE_DELAY_TIME, TimeUnit.MILLISECONDS);
    }
}

// 工厂模式创建异步任务
public class AsyncFactory {
    public static TimerTask recordLogininfor(username, status, message) {
        return new TimerTask() {
            @Override
            public void run() {
                // 查询IP地址、组装日志、插入数据库
                SpringUtils.getBean(ISysLogininforService.class).insertLogininfor(logininfor);
            }
        };
    }

    public static TimerTask recordOper(SysOperLog operLog) { ... }
}
```

**典型使用场景：**

```
// 登录成功后异步记录登录日志（不阻塞主流程）
AsyncManager.me().execute(AsyncFactory.recordLogininfor(username, Constants.LOGIN_SUCCESS, message));

// 操作完成后异步记录操作日志
AsyncManager.me().execute(AsyncFactory.recordOper(operLog));
```

### 3.4 AOP操作日志 (@Log)

```
@Aspect
@Component
public class LogAspect {
    @AfterReturning(pointcut = "@annotation(controllerLog)", returning = "jsonResult")
    public void doAfterReturning(JoinPoint joinPoint, Log controllerLog, Object jsonResult) {
        handleLog(joinPoint, controllerLog, null, jsonResult);
    }

    @AfterThrowing(pointcut = "@annotation(controllerLog)", throwing = "e")
    public void doAfterThrowing(JoinPoint joinPoint, Log controllerLog, Exception e) {
        handleLog(joinPoint, controllerLog, e, null);
    }
}
```

**Controller使用：**

```
@Log(title = "定时任务调度日志", businessType = BusinessType.DELETE)
@DeleteMapping("/{jobLogIds}")
public AjaxResult remove(@PathVariable Long[] jobLogIds) { ... }
```

### 3.5 线程池配置

```
@Configuration
public class ThreadPoolConfig {
    @Bean
    public ScheduledExecutorService scheduledExecutorService() {
        return Executors.newScheduledThreadPool(20);  // 定时任务线程池
    }

    @Bean
    public ThreadPoolTaskExecutor threadPoolTaskExecutor() {
        // 核心线程、最大线程、队列、拒绝策略等配置
    }
}
```

---

---

## 4. IIOT消费队列模块

### 4.1 Zeta-MQ-SDK 架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    IIOT消息消费架构                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ZiFiClient (抽象基类)                                           │
│       └── KafkaZiFiClient (Kafka实现)                            │
│            ├── init(region, apiKey, apiSecret, certPath)        │
│            │     → SASL_SSL安全认证                              │
│            │     → 证书从classpath提取到临时文件                    │
│            ├── subscribe() → 订阅.*-v2的topic正则                │
│            ├── poll()      → ConsumerRecords → List<Message>    │
│            └── commit()    → 手动提交offset                      │
│                                                                 │
│  KafkaMessage (消息封装)                                         │
│       ├── body: 消息体                                           │
│       ├── messageId: offset                                     │
│       └── head: topicName, partition, time                      │
│                                                                 │
│  ApTagMessageServiceImpl (业务层)                                │
│       ├── 批量插入 (insertApTagMessageRecord)                    │
│       ├── 批量处理标记 (processRecordList)                       │
│       ├── 分页查询 + 项目权限过滤                                  │
│       └── 分批清理老数据 (batchSize=3000, sleep=100ms)            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Kafka消费者关键配置

```
// KafkaZiFiClient 核心配置
props.setProperty(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, url);
props.setProperty(ConsumerConfig.GROUP_ID_CONFIG, apiKey);
props.setProperty(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, "false");  // 手动提交
props.setProperty("security.protocol", "SASL_SSL");
props.setProperty("sasl.mechanism", "PLAIN");
props.setProperty("ssl.endpoint.identification.algorithm", "");  // 禁用主机名验证
```

**证书处理技巧：** 从classpath读取JKS证书 → 写入临时文件 → JVM退出时自动删除。解决jar包内证书路径问题。

### 4.3 数据源动态配置

```
@Data
public class ProjectDatasource extends BaseEntity {
    @TableId(type = IdType.INPUT)  // 手动指定ID
    private Integer projectId;
    private Integer sourceType;    // 0=数据库, 1=Kafka
    private String sourceAddr;     // 数据源地址
    private String sourceTable;    // 数据源表
    private String sourceUser;     // 用户名
    private String sourcePwd;      // 密码
    private String keyMapContent;  // 字段映射JSON配置
    private Integer status;        // 状态
}
```

### 4.4 外部数据同步流程

```
// SyncDataTask 完整流程
1. 解析 keyMapContent JSON → 动态拼接查询字段
2. JDBC直连外部数据库查询数据
3. ResultSet → SmartDeviceMessageRecord 对象映射
4. MyBatis BATCH模式批量插入 (batchSize=5000)
5. 异步链式回调: cleanDeviceMessage → processDeviceMessage
```

---

---

## 5. ORM层：MyBatis-Plus 使用方式

### 5.1 配置层

```
@Configuration
@MapperScan("com.chentong.**.mapper")
public class MybatisPlusConfig {
    // 分页插件、乐观锁插件、多租户插件等
}
```

### 5.2 Entity模式

```
@EqualsAndHashCode(callSuper = true)
@Data
public class ProjectDatasource extends BaseEntity {
    @TableId(type = IdType.INPUT)     // 手动输入ID
    private Integer projectId;
    // @TableId(type = IdType.AUTO)   // 自增
    // @TableId(type = IdType.ASSIGN_ID)  // 雪花算法
}

@Data
public class BaseEntity implements Serializable {
    private static final long serialVersionUID = 1L;

    @TableField(exist = false)        // 非数据库字段
    private Map<String, Object> params;

    private String createBy;          // 自动填充
    private Date createTime;
    private String updateBy;
    private Date updateTime;
}
```

### 5.3 Mapper模式

```
// 接口继承 BaseMapper<T>
public interface ApTagMessageMapper extends BaseMapper<ApTagMessageRecord> {

    // 自定义方法 - 配合XML使用
    boolean insertApTagMessageRecord(@Param("list") List<ApTagMessageRecord> list);
    boolean processRecordList(@Param("list") List<ApTagMessageRecord> list);
    int deleteBatchByTime(@Param("targetTime") Date targetTime, @Param("batchSize") int batchSize);
}

// 分页查询 - 使用MP内置Page
Page<ApTagMessageRecord> selectApTagMessageRecordList(
    Page<ApTagMessageRecord> page,
    @Param("query") ApTagMessageRecord record,
    @Param("projectIds") Set<Integer> projectIds
);
```

### 5.4 Service模式

```
// 接口继承 IService<T>
public interface IApTagMessageService extends IService<ApTagMessageRecord> {
    boolean insertApTagMessageRecord(List<ApTagMessageRecord> list);
    Page<ApTagMessageRecord> selectApTagMessageRecordList(Page<ApTagMessageRecord> page, ...);
}

// 实现类继承 ServiceImpl<M, T>
@Service
public class ApTagMessageServiceImpl
    extends ServiceImpl<ApTagMessageMapper, ApTagMessageRecord>
    implements IApTagMessageService {

    @Autowired
    private ApTagMessageMapper apTagMessageMapper;

    // 可直接使用父类方法: save(), saveBatch(), removeById(), getById(), list(), page() 等
}
```

### 5.5 分页查询模式

```
// Controller层构建分页
public class BaseController {
    protected Page<T> buildPage() {
        PageDomain pageDomain = TableSupport.buildPageRequest();
        Integer pageNum = pageDomain.getPageNum();
        Integer pageSize = pageDomain.getPageSize();
        return new Page<>(pageNum, pageSize);
    }
}

// Service层调用
Page<SysJobLog> list = jobLogService.selectJobLogList(buildPage(), sysJobLog);
return getDataTable(list);  // 转换为TableDataInfo返回
```

### 5.6 批量操作

```
// MyBatis BATCH模式
try (SqlSession sqlSession = sqlSessionFactory.openSession(ExecutorType.BATCH, false)) {
    SmartDeviceMessageRecordMapper mapper = sqlSession.getMapper(SmartDeviceMessageRecordMapper.class);
    List<SmartDeviceMessageRecord> batch = new ArrayList<>();
    int batchSize = 5000;

    while (resultSet.next()) {
        batch.add(record);
        if (batch.size() >= batchSize) {
            mapper.insertBatch(batch);  // 批量插入
            batch.clear();
        }
    }
    if (!batch.isEmpty()) {
        mapper.insertBatch(batch);  // 插入剩余数据
    }
    sqlSession.commit();
}
```

### 5.7 动态数据源

```
@Configuration
public class DruidConfig {
    @Bean
    @ConfigurationProperties("spring.datasource.druid.master")
    public DataSource masterDataSource() { ... }

    @Bean
    @Primary
    public DynamicDataSource dataSource(DataSource masterDataSource) {
        Map<Object, Object> targetDataSources = new HashMap<>();
        targetDataSources.put(DataSourceType.MASTER.getType(), masterDataSource);
        setSlaveDataSource(targetDataSources);  // 设置从库
        return new DynamicDataSource(masterDataSource, targetDataSources);
    }
}

// 切换数据源
@DataSource(DataSourceType.SLAVE)
public List<SysUser> selectUserList() { ... }
```

---

---

## 6. 基础工具模块

### 6.1 工具类清单

| 工具类             | 功能        | 核心方法                                     |
| --------------- | --------- | ---------------------------------------- |
| `RedisCache`    | Redis操作封装 | `setCacheObject()`, `getCacheObject()`, `deleteObject()`, `setCacheMap()` |
| `SecurityUtils` | 安全工具      | `getLoginUser()`, `getAuthentication()`, `isAdmin()`, `encryptPassword()` |
| `ExcelUtil<T>`  | Excel导入导出 | `importExcel()`, `exportExcel()` (基于POI) |
| `StringUtils`   | 字符串工具     | `isEmpty()`, `isNotEmpty()`, `format()`, `substring()` |
| `BeanUtils`     | Bean工具    | `copyBeanProp()`, `beanToMap()`, `mapToBean()` |
| `IpUtils`       | IP工具      | `getIpAddr()`, `isMatchedIp()` (IP黑名单校验) |
| `AddressUtils`  | 地址解析      | `getRealAddressByIP()` (IP→物理地址)         |
| `FileUtils`     | 文件工具      | 文件大小、名称、上传下载                             |
| `SqlUtil`       | SQL工具     | 防SQL注入，关键字过滤                             |
| `Threads`       | 线程工具      | `shutdownAndAwaitTermination()` 优雅关闭线程池  |
| `Convert`       | 类型转换      | `toInt()`, `toStrArray()`, `toLong()`    |

### 6.2 响应封装

```
// 统一响应体 - AjaxResult
public class AjaxResult extends HashMap<String, Object> {
    public static AjaxResult success()           // code=200
    public static AjaxResult success(Object data) // code=200 + data
    public static AjaxResult error()             // code=500
    public static AjaxResult error(String msg)   // code=500 + msg
}

// 分页响应体 - TableDataInfo
public class TableDataInfo {
    private long total;          // 总记录数
    private List<?> rows;        // 数据列表
    private int code;            // 状态码
    private String msg;          // 消息
}
```

### 6.3 基类体系

```
// Controller基类
public class BaseController {
    protected TableDataInfo getDataTable(Page<?> page)  // 分页结果封装
    protected AjaxResult toAjax(int rows)               // 操作结果封装
    protected AjaxResult toAjax(boolean result)         // 布尔结果封装
    protected Page<T> buildPage()                       // 构建分页对象
    protected Page<T> buildDownloadPage()               // 构建导出分页(大页)
}

// Entity基类
public class BaseEntity implements Serializable {
    private String createBy;     // 创建者
    private Date createTime;     // 创建时间
    private String updateBy;     // 更新者
    private Date updateTime;     // 更新时间
    private String remark;       // 备注
    @TableField(exist = false)
    private Map<String, Object> params;  // 请求参数
}

// 树形Entity基类
public class TreeEntity extends BaseEntity {
    private Long parentId;       // 父节点ID
    private String parentName;   // 父节点名称
    private Integer orderNum;    // 排序
    private String ancestors;    // 祖级列表
}
```

### 6.4 自定义注解

| 注解              | 功能     | 使用位置                 |
| --------------- | ------ | -------------------- |
| `@Log`          | 操作日志记录 | Controller方法         |
| `@DataScope`    | 数据权限过滤 | Controller/Service方法 |
| `@DataSource`   | 数据源切换  | Service方法            |
| `@RateLimiter`  | 接口限流   | Controller方法         |
| `@RepeatSubmit` | 防重复提交  | Controller方法         |
| `@Xss`          | XSS过滤  | Entity字段             |
| `@Desensitize`  | 数据脱敏   | Entity字段             |

### 6.5 全局异常处理

```
@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(AccessDeniedException.class)      // 权限不足
    @ExceptionHandler(AuthenticationException.class)    // 认证失败
    @ExceptionHandler(ServiceException.class)           // 业务异常
    @ExceptionHandler(TaskException.class)              // 定时任务异常
    @ExceptionHandler(MethodArgumentNotValidException.class) // 参数校验
}
```

---

---

## 7. 代码风格

### 7.1 分层架构

```
┌─────────────────────────────────────────────────────────┐
│                    标准分层结构                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Controller层 (admin模块)                                │
│  ├── @RestController + @RequestMapping                  │
│  ├── 继承 BaseController                                 │
│  ├── @PreAuthorize 权限校验                              │
│  ├── @Log 操作日志                                       │
│  └── 返回 AjaxResult / TableDataInfo                    │
│                                                         │
│  Service层                                               │
│  ├── 接口: I*Service                                     │
│  ├── 实现: *ServiceImpl extends ServiceImpl<M, T>       │
│  └── @Service 注解                                       │
│                                                         │
│  Mapper层                                                │
│  ├── 接口: *Mapper extends BaseMapper<T>                 │
│  ├── XML: resources/mapper/**/*.xml                     │
│  └── @MapperScan 扫描                                    │
│                                                         │
│  Domain层                                                │
│  ├── Entity: @Data + @EqualsAndHashCode(callSuper=true) │
│  ├── 继承 BaseEntity / TreeEntity                        │
│  └── @TableId, @TableField 等MP注解                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 7.2 模块划分

```
ctlms-java/
├── common       → 通用模块 (实体、工具类、枚举、注解、常量)
├── framework    → 框架模块 (安全、配置、切面、拦截器)
├── system       → 系统模块 (用户、角色、菜单、部门、日志)
├── admin        → 启动模块 (Controller、启动类)
├── quartz       → 定时任务模块
├── device       → 设备模块
├── packaging    → 包装模块
├── project      → 项目模块
├── warehouse    → 仓库模块
├── stock-transfer → 调拨模块
├── report       → 报表模块
├── alert        → 告警模块
└── zetag-mq-sdk → IIOT消息SDK
```

### 7.3 命名规范

```
// Controller: SysUserController, ApTagMessageController
// Service接口: ISysUserService, IApTagMessageService
// Service实现: SysUserServiceImpl, ApTagMessageServiceImpl
// Mapper: SysUserMapper, ApTagMessageMapper
// Entity: SysUser, ApTagMessageRecord

// 请求路径: /system/user/list, /device/apTagMessage/list
// 权限标识: system:user:list, device:apTagMessage:query
// 缓存Key: login_tokens:{uuid}, captcha_codes:{uuid}
```

### 7.4 技术栈版本

```
语言: Java 21
框架: Spring Boot + Spring MVC + Spring Security
ORM: MyBatis-Plus
安全: JWT + Redis
Jakarta: jakarta.servlet / jakarta.annotation (非javax)
工具: Lombok (@Data, @EqualsAndHashCode, @Slf4j)
JSON: Fastjson2
数据库连接池: Druid
缓存: Redis
消息队列: Kafka
定时任务: Quartz
```

---

---

## 8. 其他代码模块

### 8.1 业务模块概览

| 模块               | 职责    | 核心实体/功能                         |
| ---------------- | ----- | ------------------------------- |
| `system`         | 系统管理  | 用户、角色、菜单、部门、岗位、字典、配置、公告、日志      |
| `device`         | 设备管理  | 智能设备型号、设备消息记录、AP标签消息            |
| `packaging`      | 包装管理  | 包装模型、包装类别、设备绑定关系                |
| `project`        | 项目管理  | 项目信息、项目用户、项目数据源、仓库包装模型          |
| `warehouse`      | 仓库管理  | 仓库信息、AP仓库、用户仓库关系                |
| `stock-transfer` | 库存调拨  | 载体、出入库单据、调拨批次、调拨类型、盘点计划/明细/变更申请 |
| `report`         | 报表    | 出入库记录、日报库存、仪表盘、差异分析             |
| `alert`          | 告警    | 告警类型、告警设置                       |
| `quartz`         | 定时任务  | 任务管理、任务日志                       |
| `zetag-mq-sdk`   | 消息SDK | Kafka消费者、ZiFi客户端抽象              |

### 8.2 系统管理模块详解

```
SysUser (用户)
├── userId, deptId, userName, nickName
├── email, phonenumber, sex, avatar
├── password (BCrypt加密)
├── status (0正常 1停用)
├── loginIp, loginDate
└── roles: List<SysRole>  // 关联角色

SysRole (角色)
├── roleId, roleName, roleKey
├── dataScope (数据权限级别)
├── permissions (权限字符)
└── depts: List<SysDept>  // 自定义数据权限关联

SysMenu (菜单)
├── menuId, menuName, parentId
├── path, component (路由)
├── menuType (M目录 C菜单 F按钮)
├── perms (权限标识: "system:user:list")
└── children: List<SysMenu>

SysDept (部门)
├── deptId, parentId, deptName
├── ancestors (祖级列表: "0,100,101")
├── orderNum, leader, phone
└── children: List<SysDept>
```

### 8.3 监控模块

```
/sys/userOnline     → 在线用户监控 (Redis管理)
/sys/operlog        → 操作日志查询 (AOP自动记录)
/sys/logininfor     → 登录日志查询 (异步记录)
/monitor/cache      → Redis缓存监控
/monitor/server     → 服务器信息 (CPU/内存/JVM)
```

### 8.4 安全防护机制

| 机制    | 实现方式                                     |
| ----- | ---------------------------------------- |
| XSS防护 | + + `@Xss`注解 `XssFilter``XssHttpServletRequestWrapper` |
| SQL注入 | `SqlUtil.sqlFilter()` 关键字过滤              |
| 接口限流  | `@RateLimiter` + (基于Redis计数器) `RateLimiterAspect` |
| 防重复提交 | `@RepeatSubmit` + `RepeatSubmitInterceptor` |
| 验证码   | + Redis存储 (支持Math/Char类型) `CaptchaConfig` |
| IP黑名单 | `SysLoginService.loginPreCheck()` + Redis配置 |
| 数据脱敏  | `@Desensitize` 注解 (手机号、身份证、邮箱等)          |

### 8.5 缓存架构

```
Redis缓存Key设计:
├── login_tokens:{uuid}        → LoginUser (30分钟过期，滑动续期)
├── captcha_codes:{uuid}       → 验证码 (2分钟过期)
├── sys_config:{configKey}     → 系统配置 (永不过期，修改时删)
├── sys_dict:{dictType}        → 字典数据 (永不过期，修改时删)
├── repeat_submit:{url+params} → 防重复提交 (10秒过期)
└── rate_limit:{url+ip}        → 限流计数器 (滑动窗口)
```

### 8.6 设计模式应用

| 模式          | 应用场景                                     |
| ----------- | ---------------------------------------- |
| **模板方法**    | → before/doExecute/after `AbstractQuartzJob` |
| **单例**      | `AsyncManager.me()` 饿汉式                  |
| **工厂**      | 创建异步任务 `AsyncFactory`                    |
| **策略**      | `MisfirePolicy` 定时任务错过策略                 |
| **代理**      | Spring AOP (DataScope/Log/RateLimiter/DataSource) |
| **观察者**     | 异步回调链 `cleanDeviceMessage → callback → processDeviceMessage` |
| **Builder** | Quartz , , `JobBuilder``TriggerBuilder``CronScheduleBuilder` |
| **责任链**     | Spring Security `FilterChain`            |

---

---

## 总结：高级Java开发技能图谱

```
┌──────────────────────────────────────────────────────────────────────┐
│                    Java高级开发核心技能                                │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  安全体系        JWT签发解析 + Redis会话管理 + RBAC三级权限             │
│                  Spring Security过滤链 + 方法级权限注解                  │
│                  数据权限AOP + 上下文传递(ThreadLocal)                  │
│                                                                      │
│  并发编程        线程池配置管理 + 异步任务管理器                          │
│                  AtomicBoolean原子控制 + ThreadLocal上下文              │
│                  ScheduledExecutorService定时调度                      │
│                                                                      │
│  消息队列        Kafka生产消费 + SASL_SSL安全认证                       │
│                  手动Offset提交 + 批量消费处理                          │
│                  证书动态管理 + 消息解析封装                             │
│                                                                      │
│  ORM框架         MyBatis-Plus CRUD + 分页查询                          │
│                  批量操作(BATCH模式) + 自定义XML                        │
│                  动态数据源 + 代码生成                                  │
│                                                                      │
│  AOP编程         操作日志 + 数据权限 + 限流                             │
│                  防重复提交 + 数据源切换 + XSS过滤                      │
│                                                                      │
│  缓存架构        Redis分布式缓存 + 滑动过期策略                         │
│                  验证码/会话/配置/字典多级缓存                           │
│                                                                      │
│  工程规范        多模块分层 + 统一响应体 + 全局异常处理                   │
│                  Lombok + Jakarta EE + Fastjson2                      │
│                  代码生成 + 注解驱动                                    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```
