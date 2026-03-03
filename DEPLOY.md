# HiveMind 部署指南

> 类似 OpenClaw 的命令行工具和部署方式

---

## 📦 安装

### 方法 1: 使用安装脚本（推荐）

```bash
# 从源码安装
cd /root/.openclaw/workspace/hivemind
chmod +x install.sh
sudo ./install.sh
```

### 方法 2: 手动安装

```bash
# 创建目录
sudo mkdir -p /usr/local/hivemind
sudo mkdir -p /etc/hivemind

# 复制文件
sudo cp -r /root/.openclaw/workspace/hivemind/* /usr/local/hivemind/

# 安装依赖
cd /usr/local/hivemind
npm install

# 构建项目
npm run build || npx tsc

# 创建命令链接
sudo ln -s /usr/local/hivemind/hivemind /usr/local/bin/hivemind
sudo chmod +x /usr/local/bin/hivemind
```

---

## 🚀 快速开始

### 1. 启动 HiveMind

```bash
# 启动
hivemind start

# 检查状态
hivemind status

# 查看日志
hivemind logs

# 实时日志
hivemind logs -f
```

### 2. 停止 HiveMind

```bash
# 停止
hivemind stop

# 重启
hivemind restart
```

### 3. 配置管理

```bash
# 查看配置
hivemind config show

# 编辑配置
hivemind config edit

# 验证配置
hivemind config validate
```

### 4. 运行测试

```bash
# 运行所有测试
hivemind test
```

---

## 🔧 系统服务

### Systemd 部署

```bash
# 创建系统服务
hivemind deploy

# 手动安装（如果 deploy 生成了文件）
sudo cp /tmp/hivemind.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable hivemind
sudo systemctl start hivemind

# 查看状态
sudo systemctl status hivemind

# 查看日志
sudo journalctl -u hivemind -f
```

---

## 📝 配置文件

配置文件位置：`/etc/hivemind/config.json`

```json
{
  "hivemind": {
    "enabled": true,
    "mode": "swarm",
    "config": {
      "singleInstance": false,
      "memory": {
        "defaultLevel": "L2",
        "autoIndex": true,
        "indexInterval": 60000
      },
      "models": {
        "defaultTier": "light",
        "orchestratorTier": "light",
        "interfaceTier": "standard",
        "memoryTier": "nano"
      },
      "agents": {
        "monitoringInterval": 60000,
        "cleanupInterval": 3600000,
        "autoEvolution": true
      }
    }
  },
  "gateway": {
    "websocketUrl": "ws://127.0.0.1:18789",
    "deviceAuth": false,
    "token": ""
  },
  "logging": {
    "level": "info",
    "file": "/root/.hivemind/logs/hivemind.log",
    "maxSize": "10MB",
    "maxFiles": 5
  }
}
```

---

## 🧪 测试

### 运行测试

```bash
# 运行所有测试
hivemind test

# 或单独运行
npx tsx examples/integration-test-complete.ts
npx tsx examples/emergence-observation-test.ts
npx tsx examples/self-optimization-test.ts
```

---

## 🏥 健康检查

```bash
# 运行健康检查
hivemind health

# 输出示例：
# 🏥 Running health check...
#
# ✅ Process running (PID: 12345)
# ✅ Config file exists
# ✅ Log directory exists
#
# ✅ All checks passed
```

---

## 📊 监控和日志

### 日志位置

- **应用日志：** `~/.hivemind/logs/hivemind.log`
- **系统日志（使用 systemd）：** `journalctl -u hivemind`

### 监控命令

```bash
# 实时日志
hivemind logs -f

# 最近 100 行
hivemind logs

# Systemd 日志
sudo journalctl -u hivemind -f
sudo journalctl -u hivemind -n 100
```

---

## 🔄 更新

### 更新到最新版本

```bash
# 1. 停止服务
hivemind stop

# 2. 备份配置
cp /etc/hivemind/config.json /etc/hivemind/config.json.backup

# 3. 更新代码
cd /usr/local/hivemind
git pull origin swarm-architecture

# 4. 重新安装依赖
npm install

# 5. 重新构建
npm run build

# 6. 恢复配置（如果需要）
cp /etc/hivemind/config.json.backup /etc/hivemind/config.json

# 7. 重启服务
hivemind start
```

---

## 🗑️ 卸载

### 完全卸载

```bash
# 1. 停止服务
hivemind stop

# 2. 如果有 Systemd 服务
sudo systemctl stop hivemind
sudo systemctl disable hivemind
sudo rm /etc/systemd/system/hivemind.service
sudo systemctl daemon-reload

# 3. 删除文件
sudo rm -rf /usr/local/hivemind
sudo rm -rf /etc/hivemind
sudo rm /usr/local/bin/hivemind
sudo rm /usr/local/bin/hiv

# 4. 删除用户数据（可选）
rm -rf ~/.hivemind
rm -rf ~/.openclaw/workspace/hivemind

# 5. 清理 PID 文件
rm -f /tmp/hivemind.pid
```

---

## 🆘 故障排除

### 问题：无法启动

```bash
# 检查日志
hivemind logs

# 检查配置
hivemind config validate

# 检查端口占用
netstat -tlnp | grep 18789
```

### 问题：OpenClaw Gateway 未运行

```bash
# 启动 OpenClaw Gateway
openclaw gateway start

# 检查状态
openclaw gateway status

# 查看 Gateway 日志
openclaw gateway logs
```

### 问题：内存不足

```bash
# 调整配置中的内存限制
hivemind config edit

# 减少监控间隔
# "agents": {
#   "monitoringInterval": 120000  # 增加到 2 分钟
# }
```

---

## 🌐 网络配置

### 本地 Gateway

```json
{
  "gateway": {
    "websocketUrl": "ws://127.0.0.1:18789",
    "deviceAuth": false,
    "token": ""
  }
}
```

### 远程 Gateway

```json
{
  "gateway": {
    "websocketUrl": "ws://your-server.com:18789",
    "deviceAuth": true,
    "token": "your-device-token"
  }
}
```

---

## 📦 包结构

```
/usr/local/hivemind/
├── src/
│   ├── core/
│   ├── events/
│   ├── hive/
│   └── index.ts
├── examples/
│   ├── integration-test-complete.ts
│   ├── emergence-observation-test.ts
│   └── self-optimization-test.ts
├── package.json
├── tsconfig.json
└── hivemind  # CLI 脚本（已安装到 /usr/local/bin）

/etc/hivemind/
└── config.json

~/.hivemind/
├── logs/
└── data/
```

---

## 🔑 环境变量

可以通过环境变量覆盖配置：

```bash
export HIVEMIND_CONFIG=/path/to/config.json
export NODE_ENV=production
export HIVEMIND_LOG_LEVEL=debug
```

---

## 🎯 快速参考

| 命令 | 说明 |
|------|------|
| `hivemind start` | 启动 HiveMind |
| `hivemind stop` | 停止 HiveMind |
| `hivemind restart` | 重启 HiveMind |
| `hivemind status` | 查看状态 |
| `hivemind logs` | 查看日志 |
| `hivemind logs -f` | 实时日志 |
| `hivemind config show` | 显示配置 |
| `hivemind config edit` | 编辑配置 |
| `hivemind test` | 运行测试 |
| `hivemind health` | 健康检查 |
| `hivemind init` | 初始化工作区 |
| `hivemind deploy` | 创建部署配置 |
| `hivemind version` | 显示版本 |

---

## 📞 支持

- **GitHub:** https://github.com/Churchillhuang/hivemind
- **Issues:** https://github.com/Churchillhuang/hivemind/issues
- **Docs:** 查看项目 README.md
