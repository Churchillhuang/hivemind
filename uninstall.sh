#!/bin/bash
# HiveMind Uninstaller

set -e

echo "🗑️  HiveMind Uninstaller"
echo ""

# 确认卸载
read -p "Are you sure you want to uninstall HiveMind? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Uninstallation cancelled"
    exit 0
fi

# 停止服务
echo "🛑 Stopping HiveMind..."
if command -v hivemind &> /dev/null; then
    hivemind stop 2>/dev/null || true
elif [ -f /tmp/hivemind.pid ]; then
    PID=$(cat /tmp/hivemind.pid)
    if ps -p "$PID" > /dev/null 2>&1; then
        kill "$PID" 2>/dev/null || true
    fi
    rm -f /tmp/hivemind.pid
fi

# 停止 Systemd 服务（如果有）
echo "🛑 Stopping systemd service..."
if systemctl is-active --quiet hivemind 2>/dev/null; then
    sudo systemctl stop hivemind || true
    sudo systemctl disable hivemind || true
fi

# 删除 Systemd 服务文件
if [ -f /etc/systemd/system/hivemind.service ]; then
    sudo rm /etc/systemd/system/hivemind.service
    sudo systemctl daemon-reload
    echo "✅ Systemd service removed"
fi

# 删除安装目录
if [ -d /usr/local/hivemind ]; then
    sudo rm -rf /usr/local/hivemind
    echo "✅ Installation directory removed"
fi

# 删除配置目录
if [ -d /etc/hivemind ]; then
    sudo rm -rf /etc/hivemind
    echo "✅ Configuration directory removed"
fi

# 删除命令链接
if [ -L /usr/local/bin/hivemind ]; then
    sudo rm /usr/local/bin/hivemind
    echo "✅ Command link removed"
fi

if [ -L /usr/local/bin/hiv ]; then
    sudo rm /usr/local/bin/hiv
    echo "✅ Short command link removed"
fi

# 删除用户数据（询问）
read -p "Remove user data (~/.hivemind)? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf ~/.hivemind
    echo "✅ User data removed"
else
    echo "⚠️  User data preserved at: ~/.hivemind"
fi

# 删除工作区数据（询问）
if [ -d /root/.openclaw/workspace/hivemind ]; then
    read -p "Remove workspace data (~/.openclaw/workspace/hivemind)? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf /root/.openclaw/workspace/hivemind
        echo "✅ Workspace data removed"
    else
        echo "⚠️  Workspace data preserved at: /root/.openclaw/workspace/hivemind"
    fi
fi

# 清理临时文件
rm -f /tmp/hivemind.pid
echo "✅ Temporary files cleaned"

echo ""
echo -e "${GREEN}✅ Uninstallation completed!${NC}"
