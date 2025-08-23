# 智慧河道巡查系统 - 部署运维指南

## 1. 部署环境要求

### 1.1 硬件环境

#### 生产环境最低要求
- **CPU**: 8核 2.4GHz 以上
- **内存**: 16GB RAM 以上
- **存储**: 500GB SSD + 2TB HDD
- **网络**: 千兆网卡，100Mbps 以上带宽

#### 推荐配置
- **CPU**: 16核 3.0GHz Intel Xeon 或同等性能
- **内存**: 32GB RAM 
- **存储**: 1TB SSD (系统+数据库) + 4TB HDD (文件存储)
- **网络**: 双千兆网卡，200Mbps 以上带宽

### 1.2 软件环境

#### 操作系统
- **生产推荐**: Ubuntu 20.04 LTS / CentOS 8.x
- **开发环境**: macOS 10.15+ / Windows 10+
- **容器环境**: Docker 20.10+ / Kubernetes 1.20+

#### 基础软件
- **Java**: OpenJDK 11+ 或 Oracle JDK 11+
- **Node.js**: v16.x LTS 以上
- **Python**: 3.8+ (数据分析服务)
- **Nginx**: 1.18+ (反向代理)

#### 数据库
- **关系数据库**: PostgreSQL 13+ (主数据库)
- **缓存数据库**: Redis 6.0+ (缓存和会话)
- **搜索引擎**: Elasticsearch 7.x (日志和搜索)
- **消息队列**: RabbitMQ 3.8+ (异步消息)

## 2. 系统部署架构

### 2.1 部署架构图
```
Internet
    │
┌───▼───┐    ┌─────────────────┐
│  CDN  │    │   Load Balancer │
└───────┘    └─────────────────┘
                       │
            ┌──────────┼──────────┐
            │          │          │
    ┌───────▼─┐ ┌─────▼─┐ ┌─────▼─┐
    │ Web-01  │ │Web-02 │ │Web-03 │  (Nginx)
    └─────────┘ └───────┘ └───────┘
            │          │          │
    ┌───────▼──────────▼──────────▼───┐
    │        API Gateway              │
    └─────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
┌───────▼─┐    ┌──────▼─┐    ┌──────▼─┐
│Service-1│    │Service-2│    │Service-N│  (Microservices)
└─────────┘    └────────┘    └────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
┌───────▼─┐    ┌──────▼─┐    ┌──────▼─┐
│PostgreSQL│    │ Redis  │    │  File  │  (Data Layer)
│(Master) │    │Cluster │    │Storage │
└─────────┘    └────────┘    └────────┘
        │
┌───────▼─┐
│PostgreSQL│
│(Replica)│
└─────────┘
```

### 2.2 服务器分配方案

#### 单机部署 (开发/测试)
```yaml
服务器配置:
  - CPU: 4核
  - 内存: 8GB  
  - 存储: 200GB SSD
  
部署组件:
  - 应用服务 (Spring Boot)
  - 数据库 (PostgreSQL + Redis)
  - 文件存储 (本地存储)
  - 反向代理 (Nginx)
```

#### 集群部署 (生产环境)
```yaml
负载均衡器: 2台
  - CPU: 4核, 内存: 8GB
  - 软件: Nginx + Keepalived

应用服务器: 3台  
  - CPU: 8核, 内存: 16GB
  - 软件: Java应用 + Docker

数据库服务器: 3台
  - 主库: CPU 8核, 内存: 32GB, SSD 500GB
  - 从库: CPU 4核, 内存: 16GB, SSD 200GB  
  - 缓存: CPU 4核, 内存: 16GB, SSD 100GB

文件存储服务器: 2台
  - CPU: 4核, 内存: 8GB
  - 存储: 2TB HDD + 200GB SSD
```

## 3. 环境搭建

### 3.1 基础环境安装

#### 3.1.1 Java环境安装
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install openjdk-11-jdk

# CentOS/RHEL
sudo yum install java-11-openjdk-devel

# 验证安装
java -version
javac -version
```

#### 3.1.2 Node.js环境安装
```bash
# 使用NodeSource官方源
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证安装
node --version
npm --version

# 安装常用全局包
npm install -g pm2 yarn
```

#### 3.1.3 Docker环境安装
```bash
# 安装Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 启动Docker服务
sudo systemctl start docker
sudo systemctl enable docker

# 安装Docker Compose
sudo pip3 install docker-compose

# 验证安装
docker --version
docker-compose --version
```

### 3.2 数据库部署

#### 3.2.1 PostgreSQL安装配置
```bash
# 安装PostgreSQL
sudo apt install postgresql postgresql-contrib

# 创建数据库和用户
sudo -u postgres psql
CREATE DATABASE riverpatrol;
CREATE USER rp_user WITH ENCRYPTED PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE riverpatrol TO rp_user;
\\q

# 配置PostgreSQL
sudo vim /etc/postgresql/13/main/postgresql.conf
# 修改配置项
listen_addresses = '*'
max_connections = 200
shared_buffers = 256MB
effective_cache_size = 1GB

# 配置访问权限
sudo vim /etc/postgresql/13/main/pg_hba.conf
# 添加访问规则
host    riverpatrol     rp_user         10.0.0.0/8            md5

# 重启服务
sudo systemctl restart postgresql
```

#### 3.2.2 Redis安装配置
```bash
# 安装Redis
sudo apt install redis-server

# 配置Redis
sudo vim /etc/redis/redis.conf
# 修改配置项
bind 0.0.0.0
requirepass secure_redis_password
maxmemory 1gb
maxmemory-policy allkeys-lru

# 重启服务
sudo systemctl restart redis-server
sudo systemctl enable redis-server

# 验证连接
redis-cli -h localhost -p 6379 -a secure_redis_password ping
```

### 3.3 应用服务部署

#### 3.3.1 后端服务部署
```bash
# 创建应用目录
sudo mkdir -p /opt/riverpatrol
sudo chown $USER:$USER /opt/riverpatrol

# 下载应用包
cd /opt/riverpatrol
wget https://releases.riverpatrol.com/api-service-1.0.0.jar

# 创建配置文件
cat > application.yml << EOF
server:
  port: 8080
  
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/riverpatrol
    username: rp_user
    password: secure_password
  
  redis:
    host: localhost
    port: 6379
    password: secure_redis_password
    
logging:
  level:
    root: INFO
  file:
    name: /opt/riverpatrol/logs/application.log
EOF

# 创建启动脚本
cat > start.sh << EOF
#!/bin/bash
export JAVA_OPTS=\"-Xms2g -Xmx4g -XX:+UseG1GC\"
nohup java \\$JAVA_OPTS -jar api-service-1.0.0.jar \\
  --spring.config.location=application.yml > /dev/null 2>&1 &
echo \\$! > app.pid
EOF

chmod +x start.sh
```

#### 3.3.2 前端应用部署
```bash
# 安装Nginx
sudo apt install nginx

# 创建站点配置
sudo vim /etc/nginx/sites-available/riverpatrol
```

```nginx
server {
    listen 80;
    server_name riverpatrol.example.com;
    root /var/www/riverpatrol;
    index index.html index.htm;

    # 前端静态资源
    location / {
        try_files $uri $uri/ /index.html;
        expires 1h;
        add_header Cache-Control \"public, immutable\";
    }

    # API代理
    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 超时设置
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    # 文件上传大小限制
    client_max_body_size 50M;

    # 安全头部
    add_header X-Frame-Options \"SAMEORIGIN\" always;
    add_header X-Content-Type-Options \"nosniff\" always;
    add_header X-XSS-Protection \"1; mode=block\" always;
}
```

```bash
# 启用站点
sudo ln -s /etc/nginx/sites-available/riverpatrol /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 部署前端文件
sudo mkdir -p /var/www/riverpatrol
sudo chown www-data:www-data /var/www/riverpatrol
# 上传构建后的前端文件到该目录
```

### 3.4 Docker容器化部署

#### 3.4.1 Dockerfile示例
```dockerfile
# 后端API服务
FROM openjdk:11-jre-slim

WORKDIR /app

# 复制应用文件
COPY target/api-service-1.0.0.jar app.jar
COPY src/main/resources/application-docker.yml application.yml

# 设置时区
ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=60s \\
  CMD curl -f http://localhost:8080/actuator/health || exit 1

# 启动应用
EXPOSE 8080
ENTRYPOINT [\"java\", \"-jar\", \"app.jar\"]
```

#### 3.4.2 Docker Compose配置
```yaml
version: '3.8'

services:
  # 数据库服务
  postgres:
    image: postgres:13
    container_name: riverpatrol-db
    environment:
      POSTGRES_DB: riverpatrol
      POSTGRES_USER: rp_user
      POSTGRES_PASSWORD: secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - \"5432:5432\"
    restart: unless-stopped
    networks:
      - riverpatrol-net

  # Redis缓存
  redis:
    image: redis:6-alpine
    container_name: riverpatrol-redis
    command: redis-server --requirepass secure_redis_password
    volumes:
      - redis_data:/data
    ports:
      - \"6379:6379\"
    restart: unless-stopped
    networks:
      - riverpatrol-net

  # 后端API服务
  api-service:
    build: .
    container_name: riverpatrol-api
    environment:
      SPRING_PROFILES_ACTIVE: docker
      DB_HOST: postgres
      REDIS_HOST: redis
    ports:
      - \"8080:8080\"
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    networks:
      - riverpatrol-net
    healthcheck:
      test: [\"CMD\", \"curl\", \"-f\", \"http://localhost:8080/actuator/health\"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Nginx反向代理
  nginx:
    image: nginx:alpine
    container_name: riverpatrol-nginx
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./web:/usr/share/nginx/html
    ports:
      - \"80:80\"
      - \"443:443\"
    depends_on:
      - api-service
    restart: unless-stopped
    networks:
      - riverpatrol-net

volumes:
  postgres_data:
  redis_data:

networks:
  riverpatrol-net:
    driver: bridge
```

#### 3.4.3 启动容器
```bash
# 构建和启动服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f api-service

# 重启服务
docker-compose restart api-service

# 停止服务
docker-compose down
```

## 4. 系统配置

### 4.1 应用配置

#### 4.1.1 数据库配置
```yaml
spring:
  datasource:
    # 主数据库
    primary:
      jdbc-url: jdbc:postgresql://db-master:5432/riverpatrol
      username: ${DB_USER:rp_user}
      password: ${DB_PASSWORD:secure_password}
      driver-class-name: org.postgresql.Driver
      # 连接池配置
      hikari:
        maximum-pool-size: 20
        minimum-idle: 5
        idle-timeout: 300000
        connection-timeout: 20000
        validation-timeout: 5000
    
    # 只读副本数据库
    replica:
      jdbc-url: jdbc:postgresql://db-replica:5432/riverpatrol
      username: ${DB_USER:rp_user}
      password: ${DB_PASSWORD:secure_password}
      driver-class-name: org.postgresql.Driver
      hikari:
        maximum-pool-size: 10
        minimum-idle: 2
```

#### 4.1.2 Redis配置
```yaml
spring:
  redis:
    # 单机配置
    host: ${REDIS_HOST:localhost}
    port: ${REDIS_PORT:6379}
    password: ${REDIS_PASSWORD:}
    database: 0
    timeout: 2000ms
    
    # 连接池配置
    lettuce:
      pool:
        max-active: 50
        max-wait: 2000ms
        max-idle: 20
        min-idle: 5
    
    # 集群配置 (可选)
    cluster:
      nodes:
        - redis-1:6379
        - redis-2:6379
        - redis-3:6379
      max-redirects: 3
```

#### 4.1.3 文件存储配置
```yaml
file:
  storage:
    # 存储类型: local, oss, cos
    type: ${FILE_STORAGE_TYPE:local}
    
    # 本地存储
    local:
      base-path: ${FILE_BASE_PATH:/opt/riverpatrol/files}
      url-prefix: ${FILE_URL_PREFIX:http://localhost/files}
    
    # 阿里云OSS
    oss:
      endpoint: ${OSS_ENDPOINT:oss-cn-beijing.aliyuncs.com}
      access-key: ${OSS_ACCESS_KEY:}
      secret-key: ${OSS_SECRET_KEY:}
      bucket: ${OSS_BUCKET:riverpatrol-files}
    
  # 文件上传限制
  upload:
    max-size: 50MB
    allowed-types:
      - image/jpeg
      - image/png
      - video/mp4
      - application/pdf
```

### 4.2 系统参数配置

#### 4.2.1 日志配置
```yaml
logging:
  level:
    root: INFO
    com.riverpatrol: DEBUG
    org.springframework.security: DEBUG
  
  pattern:
    console: \"%d{yyyy-MM-dd HH:mm:ss} [%thread] %-5level %logger{36} - %msg%n\"
    file: \"%d{yyyy-MM-dd HH:mm:ss.SSS} [%thread] %-5level %logger{50} - %msg%n\"
  
  file:
    name: logs/application.log
    max-size: 100MB
    max-history: 30
    total-size-cap: 1GB
  
  # 单独的访问日志
  logback:
    access:
      enabled: true
      config: classpath:logback-access.xml
```

#### 4.2.2 监控配置
```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,prometheus
  endpoint:
    health:
      show-details: when-authorized
      probes:
        enabled: true
  
  metrics:
    export:
      prometheus:
        enabled: true
    web:
      server:
        request:
          autotime:
            enabled: true
            percentiles: 0.5,0.95,0.99
            percentiles-histogram: true
```

### 4.3 安全配置

#### 4.3.1 SSL证书配置
```bash
# 申请Let's Encrypt证书
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d riverpatrol.example.com

# 或使用自签名证书（仅开发环境）
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \\
  -keyout /etc/ssl/private/riverpatrol.key \\
  -out /etc/ssl/certs/riverpatrol.crt
```

#### 4.3.2 防火墙配置
```bash
# Ubuntu UFW配置
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable

# CentOS Firewalld配置  
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

## 5. 监控运维

### 5.1 系统监控

#### 5.1.1 监控指标
```yaml
# 系统层面
- CPU使用率
- 内存使用率  
- 磁盘使用率
- 网络流量
- 负载均衡

# 应用层面
- JVM堆内存使用
- 垃圾回收统计
- 线程池状态
- 接口响应时间
- 错误率统计

# 数据库层面
- 连接数
- QPS/TPS
- 慢查询
- 锁等待
- 复制延迟

# 业务层面
- 用户活跃度
- 工单处理量
- 上报成功率
- 系统可用率
```

#### 5.1.2 Prometheus配置
```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - \"riverpatrol-rules.yml\"

scrape_configs:
  # 应用监控
  - job_name: 'riverpatrol-api'
    static_configs:
      - targets: ['localhost:8080']
    metrics_path: '/actuator/prometheus'
    scrape_interval: 10s
  
  # 系统监控
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['localhost:9100']
  
  # 数据库监控
  - job_name: 'postgres-exporter'
    static_configs:
      - targets: ['localhost:9187']

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

#### 5.1.3 告警规则
```yaml
# riverpatrol-rules.yml
groups:
- name: riverpatrol-alerts
  rules:
  # 应用层告警
  - alert: ApplicationDown
    expr: up{job=\"riverpatrol-api\"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: \"RiverPatrol API服务下线\"
      description: \"API服务已经下线超过1分钟\"

  - alert: HighResponseTime
    expr: http_request_duration_seconds{quantile=\"0.95\"} > 2
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: \"API响应时间过长\"
      description: \"95%请求响应时间超过2秒\"

  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~\"5..\"}[5m]) > 0.1
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: \"API错误率过高\"
      description: \"5xx错误率超过10%\"

  # 系统层告警
  - alert: HighCPUUsage
    expr: 100 - (avg by (instance) (irate(node_cpu_seconds_total{mode=\"idle\"}[5m])) * 100) > 80
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: \"CPU使用率过高\"
      description: \"CPU使用率超过80%持续5分钟\"

  - alert: HighMemoryUsage
    expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes * 100 > 85
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: \"内存使用率过高\"
      description: \"内存使用率超过85%持续5分钟\"

  - alert: DiskSpaceLow
    expr: (node_filesystem_avail_bytes{fstype!=\"tmpfs\"} / node_filesystem_size_bytes{fstype!=\"tmpfs\"}) * 100 < 15
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: \"磁盘空间不足\"
      description: \"磁盘可用空间少于15%\"

  # 数据库告警
  - alert: PostgreSQLDown
    expr: pg_up == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: \"PostgreSQL数据库下线\"
      description: \"数据库连接失败超过1分钟\"

  - alert: PostgreSQLSlowQueries
    expr: rate(pg_stat_activity_count{state=\"active\"}[5m]) > 100
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: \"数据库慢查询过多\"
      description: \"活跃查询数量过高\"
```

### 5.2 日志管理

#### 5.2.1 ELK配置
```yaml
# docker-compose-elk.yml
version: '3.8'

services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:7.15.2
    container_name: elasticsearch
    environment:
      - node.name=elasticsearch
      - cluster.name=riverpatrol-cluster
      - discovery.type=single-node
      - bootstrap.memory_lock=true
      - \"ES_JAVA_OPTS=-Xms1g -Xmx1g\"
    ulimits:
      memlock:
        soft: -1
        hard: -1
    volumes:
      - es_data:/usr/share/elasticsearch/data
    ports:
      - \"9200:9200\"
    networks:
      - elk

  logstash:
    image: docker.elastic.co/logstash/logstash:7.15.2
    container_name: logstash
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
    ports:
      - \"5044:5044\"
      - \"9600:9600\"
    environment:
      LS_JAVA_OPTS: \"-Xmx1g -Xms1g\"
    networks:
      - elk
    depends_on:
      - elasticsearch

  kibana:
    image: docker.elastic.co/kibana/kibana:7.15.2
    container_name: kibana
    ports:
      - \"5601:5601\"
    environment:
      ELASTICSEARCH_URL: http://elasticsearch:9200
      ELASTICSEARCH_HOSTS: '[\"http://elasticsearch:9200\"]'
    networks:
      - elk
    depends_on:
      - elasticsearch

volumes:
  es_data:

networks:
  elk:
    driver: bridge
```

#### 5.2.2 Filebeat配置
```yaml
# filebeat.yml
filebeat.inputs:
- type: log
  enabled: true
  paths:
    - /opt/riverpatrol/logs/*.log
  fields:
    service: riverpatrol-api
    environment: production
  multiline.pattern: '^\\d{4}-\\d{2}-\\d{2}'
  multiline.negate: true
  multiline.match: after

- type: log
  enabled: true
  paths:
    - /var/log/nginx/access.log
  fields:
    service: nginx
    log_type: access

output.logstash:
  hosts: [\"logstash:5044\"]

processors:
- add_host_metadata:
    when.not.contains.tags: forwarded
```

### 5.3 备份恢复

#### 5.3.1 数据库备份
```bash
#!/bin/bash
# postgresql-backup.sh

# 配置信息
DB_HOST=\"localhost\"
DB_PORT=\"5432\"  
DB_NAME=\"riverpatrol\"
DB_USER=\"rp_user\"
BACKUP_DIR=\"/backup/postgresql\"
DATE=$(date +\"%Y%m%d_%H%M%S\")

# 创建备份目录
mkdir -p $BACKUP_DIR

# 全量备份
pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME \\
  --no-password --verbose --format=custom \\
  --file=\"$BACKUP_DIR/riverpatrol_full_$DATE.dump\"

# 只备份结构  
pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME \\
  --no-password --schema-only --format=custom \\
  --file=\"$BACKUP_DIR/riverpatrol_schema_$DATE.dump\"

# 清理7天前的备份
find $BACKUP_DIR -name \"riverpatrol_*.dump\" -mtime +7 -delete

# 备份文件上传到云存储（可选）
# aws s3 cp $BACKUP_DIR/riverpatrol_full_$DATE.dump s3://backup-bucket/
```

#### 5.3.2 文件备份
```bash  
#!/bin/bash
# files-backup.sh

# 配置信息
SOURCE_DIR=\"/opt/riverpatrol/files\"
BACKUP_DIR=\"/backup/files\"
DATE=$(date +\"%Y%m%d\")

# 创建备份目录
mkdir -p $BACKUP_DIR

# 增量备份
rsync -av --delete $SOURCE_DIR/ $BACKUP_DIR/current/

# 创建每日快照
cp -al $BACKUP_DIR/current $BACKUP_DIR/snapshot_$DATE

# 清理30天前的快照
find $BACKUP_DIR -name \"snapshot_*\" -mtime +30 -exec rm -rf {} \\;
```

#### 5.3.3 恢复脚本
```bash
#!/bin/bash
# restore.sh

BACKUP_FILE=$1
DB_HOST=\"localhost\"
DB_PORT=\"5432\"
DB_NAME=\"riverpatrol\"
DB_USER=\"rp_user\"

if [ -z \"$BACKUP_FILE\" ]; then
  echo \"Usage: $0 <backup_file>\"
  exit 1
fi

echo \"恢复数据库: $BACKUP_FILE\"

# 停止应用服务
sudo systemctl stop riverpatrol-api

# 删除现有数据库
dropdb -h $DB_HOST -p $DB_PORT -U postgres $DB_NAME

# 创建新数据库
createdb -h $DB_HOST -p $DB_PORT -U postgres $DB_NAME -O $DB_USER

# 恢复数据
pg_restore -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME \\
  --no-password --verbose $BACKUP_FILE

# 启动应用服务
sudo systemctl start riverpatrol-api

echo \"数据恢复完成\"
```

## 6. 性能调优

### 6.1 JVM调优

#### 6.1.1 JVM参数
```bash
# 生产环境JVM参数
JAVA_OPTS=\"-server \\
-Xms4g -Xmx4g \\
-XX:+UseG1GC \\
-XX:MaxGCPauseMillis=200 \\
-XX:+UnlockExperimentalVMOptions \\
-XX:+UseStringDeduplication \\
-XX:+PrintGC \\
-XX:+PrintGCDetails \\
-XX:+PrintGCTimeStamps \\
-Xloggc:gc.log \\
-XX:+UseGCLogFileRotation \\
-XX:NumberOfGCLogFiles=5 \\
-XX:GCLogFileSize=10M \\
-Dspring.profiles.active=prod\"
```

#### 6.1.2 内存分析
```bash
# 生成堆转储
jcmd <pid> GC.run_finalization
jcmd <pid> VM.gc
jmap -dump:format=b,file=heap.hprof <pid>

# 分析GC日志
# 使用GCViewer或在线工具分析gc.log

# 查看线程状态
jstack <pid> > threads.dump
```

### 6.2 数据库调优

#### 6.2.1 PostgreSQL配置优化
```sql
-- postgresql.conf优化配置
max_connections = 200
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 4MB
min_wal_size = 1GB
max_wal_size = 4GB
max_worker_processes = 8
max_parallel_workers_per_gather = 2
max_parallel_workers = 8
max_parallel_maintenance_workers = 2
```

#### 6.2.2 索引优化
```sql
-- 查找未使用的索引
SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE idx_tup_read = 0 AND idx_tup_fetch = 0;

-- 查找重复索引
SELECT pg_size_pretty(sum(pg_relation_size(idx))::bigint) as size,
       (array_agg(idx))[1] as idx1, (array_agg(idx))[2] as idx2,
       (array_agg(idx))[3] as idx3, (array_agg(idx))[4] as idx4
FROM (
    SELECT indexrelid::regclass as idx, (indrelid::text ||E'\\n'|| indclass::text ||E'\\n'|| indkey::text ||E'\\n'||
           coalesce(indexprs::text,'')||E'\\n' || coalesce(indpred::text,'')) as KEY
    FROM pg_index) sub
GROUP BY KEY HAVING count(*)>1
ORDER BY sum(pg_relation_size(idx)) DESC;
```

### 6.3 应用层调优

#### 6.3.1 连接池配置
```yaml
spring:
  datasource:
    hikari:
      # 最大连接数
      maximum-pool-size: 20
      # 最小空闲连接数  
      minimum-idle: 5
      # 连接超时时间
      connection-timeout: 20000
      # 空闲超时时间
      idle-timeout: 300000
      # 最大生命周期
      max-lifetime: 1200000
      # 连接测试查询
      connection-test-query: SELECT 1
```

#### 6.3.2 缓存优化
```yaml
spring:
  cache:
    type: redis
    redis:
      time-to-live: 600000
      cache-null-values: false
    cache-names:
      - userCache
      - configCache
      - dictCache

# 自定义缓存配置
cache:
  redis:
    default-ttl: 3600
    configs:
      userCache:
        ttl: 1800
      configCache:
        ttl: 7200
      dictCache:
        ttl: 86400
```

## 7. 故障处理

### 7.1 常见故障排查

#### 7.1.1 应用启动失败
```bash
# 检查端口占用
netstat -tlnp | grep 8080
lsof -i :8080

# 检查JVM内存
free -h
ps aux | grep java

# 查看启动日志
tail -f /opt/riverpatrol/logs/application.log

# 检查配置文件
java -jar app.jar --debug
```

#### 7.1.2 数据库连接问题
```bash
# 测试数据库连接
psql -h localhost -U rp_user -d riverpatrol

# 检查连接数
sudo -u postgres psql -c \"SELECT count(*) FROM pg_stat_activity;\"

# 查看锁等待
sudo -u postgres psql -c \"SELECT * FROM pg_stat_activity WHERE waiting = true;\"

# 重启数据库服务
sudo systemctl restart postgresql
```

#### 7.1.3 内存泄漏排查
```bash
# 监控内存使用
free -h
ps -eo pid,ppid,cmd,%mem,%cpu --sort=-%mem | head

# JVM内存分析
jstat -gc -h 10 <pid> 1s
jmap -histo <pid> | head -20

# 生成内存快照分析
jmap -dump:live,format=b,file=heap.hprof <pid>
```

### 7.2 应急处理

#### 7.2.1 服务重启脚本
```bash
#!/bin/bash
# emergency-restart.sh

SERVICE_NAME=\"riverpatrol-api\"
LOG_FILE=\"/opt/riverpatrol/logs/emergency.log\"

echo \"$(date): 开始应急重启\" >> $LOG_FILE

# 检查服务状态
if pgrep -f $SERVICE_NAME > /dev/null; then
    echo \"$(date): 停止现有服务\" >> $LOG_FILE
    pkill -f $SERVICE_NAME
    sleep 10
    
    # 强制杀掉残余进程
    pkill -9 -f $SERVICE_NAME
fi

# 清理临时文件
rm -f /tmp/riverpatrol-*
rm -f /opt/riverpatrol/*.pid

# 重启服务
echo \"$(date): 重启服务\" >> $LOG_FILE
cd /opt/riverpatrol
./start.sh

# 等待服务启动
sleep 30

# 健康检查
if curl -f http://localhost:8080/actuator/health > /dev/null 2>&1; then
    echo \"$(date): 服务启动成功\" >> $LOG_FILE
else
    echo \"$(date): 服务启动失败\" >> $LOG_FILE
    exit 1
fi
```

#### 7.2.2 数据库切换脚本
```bash
#!/bin/bash
# db-failover.sh

MASTER_HOST=\"db-master\"
REPLICA_HOST=\"db-replica\"
CONFIG_FILE=\"/opt/riverpatrol/application.yml\"

# 检查主库状态
if ! pg_isready -h $MASTER_HOST -p 5432 -U rp_user; then
    echo \"主库不可用，切换到副本库\"
    
    # 修改配置文件
    sed -i \"s/$MASTER_HOST/$REPLICA_HOST/g\" $CONFIG_FILE
    
    # 重启应用
    systemctl restart riverpatrol-api
    
    # 发送告警
    curl -X POST https://hooks.slack.com/your-webhook \\
      -H 'Content-Type: application/json' \\
      -d '{\"text\":\"数据库已切换到副本库，请尽快修复主库\"}'
fi
```

### 7.3 灾难恢复

#### 7.3.1 完整系统恢复
```bash
#!/bin/bash
# disaster-recovery.sh

BACKUP_DATE=$1
BACKUP_BASE=\"/backup\"

if [ -z \"$BACKUP_DATE\" ]; then
    echo \"Usage: $0 YYYYMMDD\"
    exit 1
fi

echo \"开始灾难恢复: $BACKUP_DATE\"

# 1. 恢复数据库
echo \"恢复数据库...\"
DB_BACKUP=\"$BACKUP_BASE/postgresql/riverpatrol_full_${BACKUP_DATE}*.dump\"
if [ -f $DB_BACKUP ]; then
    ./restore.sh $DB_BACKUP
else
    echo \"数据库备份文件不存在: $DB_BACKUP\"
    exit 1
fi

# 2. 恢复应用文件
echo \"恢复应用文件...\"
APP_BACKUP=\"$BACKUP_BASE/application/app_${BACKUP_DATE}.tar.gz\"
if [ -f $APP_BACKUP ]; then
    tar -xzf $APP_BACKUP -C /opt/
else
    echo \"应用备份文件不存在: $APP_BACKUP\"
fi

# 3. 恢复上传文件
echo \"恢复上传文件...\"
FILE_BACKUP=\"$BACKUP_BASE/files/snapshot_${BACKUP_DATE}\"
if [ -d $FILE_BACKUP ]; then
    rsync -av $FILE_BACKUP/ /opt/riverpatrol/files/
else
    echo \"文件备份不存在: $FILE_BACKUP\"
fi

# 4. 重启服务
echo \"重启服务...\"
systemctl restart riverpatrol-api
systemctl restart nginx

# 5. 验证服务
echo \"验证服务状态...\"
sleep 30
if curl -f http://localhost/api/health; then
    echo \"灾难恢复完成\"
else
    echo \"服务验证失败\"
    exit 1
fi
```

---

**文档版本**: v1.0  
**最后更新**: 2024-01-20  
**维护团队**: 运维团队  
**适用环境**: 生产环境