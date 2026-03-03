#!/bin/bash
# HiveMind CLI

VERSION="1.0.0"
HIVEMIND_DIR="/usr/local/hivemind"
CONFIG_DIR="/etc/hivemind"
PID_FILE="/tmp/hivemind.pid"
LOG_FILE="$HOME/.hivemind/logs/hivemind.log"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印版本
print_version() {
    echo "HiveMind v$VERSION"
    echo "Swarm Intelligence Agent Coordination Framework"
}

# 打印帮助
print_help() {
    echo "Usage: hivemind <command> [options]"
    echo ""
    echo "Commands:"
    echo "  start       Start HiveMind"
    echo "  stop        Stop HiveMind"
    echo "  restart     Restart HiveMind"
    echo "  status      Show HiveMind status"
    echo "  logs        Show HiveMind logs"
    echo "  config      Show/edit/validate configuration"
    echo "  test        Run tests"
    echo "  init        Initialize workspace"
    echo "  deploy      Create deployment configuration"
    echo "  health      Run health check"
    echo "  version     Show version info"
    echo "  help        Show this help message"
    echo ""
    echo "Options:"
    echo "  -v, --verbose   Verbose output"
    echo "  -q, --quiet     Quiet output"
    echo ""
    echo "Examples:"
    echo "  hivemind start"
    echo "  hivemind logs -f"
    echo "  hivemind status"
    echo "  hivemind config show"
}

# 启动 HiveMind
start() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            echo -e "${YELLOW}⚠️  HiveMind is already running (PID: $PID)${NC}"
            return 1
        else
            rm -f "$PID_FILE"
        fi
    fi

    echo -e "${BLUE}🧵 Starting HiveMind...${NC}"

    # 确保日志目录存在
    mkdir -p "$(dirname "$LOG_FILE")"

    # 检查是否在安装目录
    if [ ! -d "$HIVEMIND_DIR" ]; then
        echo -e "${RED}❌ HiveMind installation directory not found: $HIVEMIND_DIR${NC}"
        return 1
    fi

    # 启动进程
    cd "$HIVEMIND_DIR"
    nohup npx tsx src/hive/HiveGatewayBridge.ts >> "$LOG_FILE" 2>&1 &
    PID=$!

    # 保存 PID
    echo $PID > "$PID_FILE"

    # 等待启动
    sleep 2

    # 检查是否成功启动
    if ps -p "$PID" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ HiveMind started successfully (PID: $PID)${NC}"
        echo "   Logs: $LOG_FILE"
        echo ""
        echo "Check status: hivemind status"
        echo "View logs: hivemind logs"
    else
        rm -f "$PID_FILE"
        echo -e "${RED}❌ Failed to start HiveMind${NC}"
        echo "   Check logs: $LOG_FILE"
        return 1
    fi
}

# 停止 HiveMind
stop() {
    if [ ! -f "$PID_FILE" ]; then
        echo -e "${YELLOW}⚠️  HiveMind is not running${NC}"
        return 1
    fi

    PID=$(cat "$PID_FILE")

    if ! ps -p "$PID" > /dev/null 2>&1; then
        rm -f "$PID_FILE"
        echo -e "${YELLOW}⚠️  HiveMind is not running (stale PID file)${NC}"
        return 1
    fi

    echo -e "${BLUE}🛑 Stopping HiveMind (PID: $PID)...${NC}"

    kill "$PID" 2>/dev/null

    # 等待进程退出
    for i in {1..10}; do
        if ! ps -p "$PID" > /dev/null 2>&1; then
            rm -f "$PID_FILE"
            echo -e "${GREEN}✅ HiveMind stopped${NC}"
            return 0
        fi
        sleep 1
    done

    # 强制杀死
    kill -9 "$PID" 2>/dev/null
    rm -f "$PID_FILE"
    echo -e "${YELLOW}⚠️  HiveMind forcefully stopped${NC}"
}

# 重启 HiveMind
restart() {
    stop
    sleep 1
    start
}

# 显示状态
status() {
    echo "HiveMind Status"
    echo "==============="
    echo ""

    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Running${NC}"
            echo "   PID: $PID"
            echo "   Config: $CONFIG_DIR/config.json"
            echo "   Logs: $LOG_FILE"
            
            # 显示资源使用
            if command -v ps &> /dev/null; then
                echo ""
                ps -p "$PID" -o pid,ppid,%cpu,%mem,etime,cmd 2>/dev/null || true
            fi
        else
            echo -e "${RED}❌ Not running (stale PID file)${NC}"
            rm -f "$PID_FILE"
        fi
    else
        echo -e "${RED}❌ Not running${NC}"
    fi

    echo ""
    echo "Configuration:"
    echo "  Install Dir: $HIVEMIND_DIR"
    echo "  Config Dir: $CONFIG_DIR"
    echo "  Log File: $LOG_FILE"
}

# 显示日志
logs() {
    if [ ! -f "$LOG_FILE" ]; then
        echo "❌ Log file not found: $LOG_FILE"
        echo "   Try running: hivemind status"
        return 1
    fi

    if [ "$1" = "-f" ] || [ "$1" = "--follow" ]; then
        tail -f "$LOG_FILE"
    else
        # 显示最后 100 行
        tail -n 100 "$LOG_FILE"
    fi
}

# 配置管理
config() {
    case "$1" in
        show)
            if [ -f "$CONFIG_DIR/config.json" ]; then
                cat "$CONFIG_DIR/config.json"
            else
                echo "❌ Config file not found: $CONFIG_DIR/config.json"
            fi
            ;;
        edit)
            EDITOR="${EDITOR:-nano}"
            if [ ! -f "$CONFIG_DIR/config.json" ]; then
                echo "Config file not found. Creating default config..."
                sudo touch "$CONFIG_DIR/config.json"
            fi
            sudo "$EDITOR" "$CONFIG_DIR/config.json"
            ;;
        validate)
            if [ ! -f "$CONFIG_DIR/config.json" ]; then
                echo "❌ Config file not found: $CONFIG_DIR/config.json"
                return 1
            fi
            
            if command -v jq &> /dev/null; then
                if jq empty "$CONFIG_DIR/config.json" 2>&1; then
                    echo -e "${GREEN}✅ Configuration is valid${NC}"
                else
                    echo -e "${RED}❌ Configuration is invalid${NC}"
                fi
            else
                echo "⚠️  jq is not installed, skipping validation"
                echo "   Install jq: apt install jq (Ubuntu/Debian)"
            fi
            ;;
        *)
            echo "Usage: hivemind config <show|edit|validate>"
            ;;
    esac
}

# 运行测试
test() {
    echo -e "${BLUE}🧪 Running HiveMind tests...${NC}"
    echo ""
    
    if [ ! -d "$HIVEMIND_DIR/examples" ]; then
        echo -e "${RED}❌ Tests directory not found: $HIVEMIND_DIR/examples${NC}"
        echo "   Make sure HiveMind is properly installed"
        return 1
    fi

    cd "$HIVEMIND_DIR"

    echo "1. Basic Integration Test..."
    echo "─────────────────────────────────"
    npx tsx examples/integration-test-complete.ts || true

    echo ""
    echo "2. Emergence Observation Test..."
    echo "─────────────────────────────────"
    timeout 35 npx tsx examples/emergence-observation-test.ts || true

    echo ""
    echo "3. Self-Optimization Test..."
    echo "─────────────────────────────────"
    timeout 30 npx tsx examples/self-optimization-test.ts || true

    echo ""
    echo -e "${GREEN}✅ Tests completed${NC}"
    echo ""
    echo "To run individual tests:"
    echo "  cd $HIVEMIND_DIR"
    echo "  npx tsx examples/integration-test-complete.ts"
    echo "  npx tsx examples/emergence-observation-test.ts"
    echo "  npx tsx examples/self-optimization-test.ts"
}

# 初始化工作区
init() {
    WORKSPACE="$HOME/.openclaw/workspace/hivemind"
    echo -e "${BLUE}📁 Initializing HiveMind workspace...${NC}"
    echo ""

    mkdir -p "$WORKSPACE"
    mkdir -p "$WORKSPACE/memory"
    mkdir -p "$WORKSPACE/sessions"
    mkdir -p "$WORKSPACE/cospecto.com"

    echo "✅ Workspace created at: $WORKSPACE"
    echo ""
    echo "Directory structure:"
    ls -la "$WORKSPACE" 2>/dev/null || echo "  (empty)"
}

# 创建部署配置
deploy() {
    echo -e "${BLUE}🚀 Creating deployment configuration...${NC}"
    echo ""

    # 创建 Systemd 服务
    cat > /tmp/hivemind.service << 'EOFSVC'
[Unit]
Description=HiveMind Agent Swarm System
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/usr/local/hivemind
ExecStart=/usr/bin/npx tsx /usr/local/hivemind/src/hive/HiveGatewayBridge.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
Environment="NODE_ENV=production"
Environment="HIVEMIND_CONFIG=/etc/hivemind/config.json"

[Install]
WantedBy=multi-user.target
EOFSVC

    echo "✅ Systemd service file created: /tmp/hivemind.service"
    echo ""
    echo "Installation commands:"
    echo "  sudo cp /tmp/hivemind.service /etc/systemd/system/"
    echo "  sudo systemctl daemon-reload"
    echo "  sudo systemctl enable hivemind"
    echo "  sudo systemctl start hivemind"
    echo ""
    echo "Management commands:"
    echo "  sudo systemctl status hivemind"
    echo "  sudo systemctl start hivemind"
    echo "  sudo systemctl stop hivemind"
    echo "  sudo systemctl restart hivemind"
    echo "  sudo journalctl -u hivemind -f"
}

# 健康检查
health() {
    echo -e "${BLUE}🏥 Running health check...${NC}"
    echo ""

    HEALTHY=true

    # 检查进程
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Process running (PID: $PID)${NC}"
        else
            echo -e "${RED}❌ Process not running${NC}"
            HEALTHY=false
        fi
    else
        echo -e "${RED}❌ No PID file${NC}"
        HEALTHY=false
    fi

    # 检查配置文件
    if [ -f "$CONFIG_DIR/config.json" ]; then
        echo -e "${GREEN}✅ Config file exists${NC}"
    else
        echo -e "${RED}❌ Config file missing${NC}"
        HEALTHY=false
    fi

    # 检查安装目录
    if [ -d "$HIVEMIND_DIR" ]; then
        echo -e "${GREEN}✅ Installation directory exists${NC}"
    else
        echo -e "${RED}❌ Installation directory missing${NC}"
        HEALTHY=false
    fi

    # 检查日志目录
    if [ -d "$(dirname "$LOG_FILE")" ]; then
        echo -e "${GREEN}✅ Log directory exists${NC}"
    else
        echo -e "${RED}❌ Log directory missing${NC}"
        HEALTHY=false
    fi

    echo ""
    if [ "$HEALTHY" = true ]; then
        echo -e "${GREEN}✅ All checks passed${NC}"
        return 0
    else
        echo -e "${RED}❌ Some checks failed${NC}"
        return 1
    fi
}

# 主函数
main() {
    case "$1" in
        start)
            start
            ;;
        stop)
            stop
            ;;
        restart)
            restart
            ;;
        status)
            status
            ;;
        logs)
            logs "$2"
            ;;
        config)
            config "$2"
            ;;
        test)
            test
            ;;
        init)
            init
            ;;
        deploy)
            deploy
            ;;
        health)
            health
            ;;
        version|-v|--version)
            print_version
            ;;
        help|-h|--help|"")
            print_help
            ;;
        *)
            echo -e "${RED}❌ Unknown command: $1${NC}"
            echo ""
            print_help
            exit 1
            ;;
    esac
}

main "$@"
