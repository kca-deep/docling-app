#!/bin/bash
# RAG 모드 서비스 파일 업데이트 배포 스크립트
# 변경사항:
#   gpt-oss-min: ctx=16K->32K, p=1->2, VRAM ~19GB
#   qwen3vl-rag: ctx=16K->8K, p=2->1, VRAM ~3.5GB
set -e

echo "=== RAG 모드 서비스 파일 업데이트 ==="

echo "[1/4] 서비스 파일 복사..."
cp /data/docling-app/docs/service/llama-server-gpt-oss-min.service /etc/systemd/system/
cp /data/docling-app/docs/service/llama-server-qwen3vl-rag.service /etc/systemd/system/
echo "  OK"

echo "[2/4] systemd daemon-reload..."
systemctl daemon-reload
echo "  OK"

echo "[3/4] 서비스 재시작..."
systemctl restart llama-server-gpt-oss-min 2>/dev/null || echo "  gpt-oss-min: not running (skip)"
systemctl restart llama-server-qwen3vl-rag 2>/dev/null || echo "  qwen3vl-rag: not running (skip)"
echo "  OK"

echo "[4/4] 서비스 상태 확인..."
echo ""
echo "--- llama-server-gpt-oss-min ---"
systemctl status llama-server-gpt-oss-min --no-pager -l 2>/dev/null || echo "  (inactive)"
echo ""
echo "--- llama-server-qwen3vl-rag ---"
systemctl status llama-server-qwen3vl-rag --no-pager -l 2>/dev/null || echo "  (inactive)"

echo ""
echo "=== 배포 완료 ==="
echo "변경사항:"
echo "  gpt-oss-min:  ctx=32K, p=2, n=16K (VRAM ~19GB)"
echo "  qwen3vl-rag:  ctx=8K,  p=1, n=8K  (VRAM ~3.5GB)"
echo ""
echo "mode-rag 전환: ~/ai_manage.sh mode-rag"
