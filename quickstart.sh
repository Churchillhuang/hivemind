#!/bin/bash
# HiveMind Quick Start Script
# 快速启动脚本 - 一键部署和运行

set -e

echo "🧵 HiveMind Quick Start"
echo "======================"
echo ""

# 颜色
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# 步骤 1: 检查环境
echo -e "${BLUE}[1/5] 检查环境...${NC}"

if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装"
    echo "请安装 Node.js >= 18.x"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm 未安装"
    exit 1
fi

if ! command -v openclaw &> /dev/null; then
    echo "⚠️  OpenClaw 未安装或不在 PATH 中"
    echo "请先安装 OpenClaw"
fi

echo -e "${GREEN}✅ 环境检查通过${NC}"
echo ""

# 步骤 2: 安装 HiveMind
echo -e "${BLUE}[2/5] 安装 HiveMind...${NC}"

if [ ! -f "/usr/local/bin/hivemind" ]; then
    chmod +x install.sh
    sudo ./install.sh
    echo -e "${GREEN}✅ HiveMind 安装完成${NC}"
else
    echo -e "${GREEN}✅ HiveMind 已安装${NC}"
fi
echo ""

# 步骤 3: 初始化工作区
echo -e "${BLUE}[3/5] 初始化工作区...${NC}"

hivemind init
echo ""

# 步骤 4: 启动 OpenClaw Gateway
echo -e "${BLUE}[4/5] 启动 OpenClaw Gateway...${NC}"

if command -v openclaw &> /dev/null; then
    openclaw gateway start || echo "⚠️  Gateway 可能已在运行"
else
    echo "⚠️  跳过 Gateway 启动（未找到 openclaw 命令）"
fi
echo ""

# 步骤 5: 启动 HiveMind
echo -e "${BLUE}[5/5] 启动 HiveMind...${NC}"

hivemind start
sleep 2
echo ""

# 验证
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ 部署完成！${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "常用命令:"
echo "  hivemind status    # 查看状态"
echo "  hivemind logs      # 查看日志"
echo "  hivemind logs -f   # 实时日志"
echo "  hivemind stop      # 停止"
echo "  hivemind test      # 运行测试"
echo "  hivemind help      # 查看帮助"
echo ""
echo "详细文档: 见 DEPLOY.md"
echo "GitHub: https://github.com/Churchillhuang/hivemind"
echo ""
