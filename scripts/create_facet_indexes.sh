#!/bin/bash
# Qdrant Facet API 활성화를 위한 document_id 인덱스 생성 스크립트
# P0-3 최적화: facet API 사용으로 고유 문서 수 집계 성능 개선

QDRANT_URL="${QDRANT_URL:-http://localhost:6333}"
QDRANT_API_KEY="${QDRANT_API_KEY:-8bc1906404d5dd2bcbf076a3f14336060fa2f82c911ccf243fee2cd2ae515404}"

echo "=== Qdrant Facet Index 생성 스크립트 ==="
echo "URL: $QDRANT_URL"
echo ""

# 모든 컬렉션 조회
collections=$(curl -s -H "api-key: $QDRANT_API_KEY" "$QDRANT_URL/collections" | \
  python3 -c "import sys, json; data=json.load(sys.stdin); print('\n'.join([c['name'] for c in data.get('result', {}).get('collections', [])]))")

if [ -z "$collections" ]; then
  echo "컬렉션을 찾을 수 없습니다."
  exit 1
fi

echo "발견된 컬렉션:"
echo "$collections"
echo ""

# 각 컬렉션에 인덱스 생성
success=0
failed=0

for collection in $collections; do
  echo -n "[$collection] document_id 인덱스 생성 중... "

  # 기존 인덱스 삭제 (있으면)
  curl -s -X DELETE "$QDRANT_URL/collections/$collection/index/document_id" \
    -H "api-key: $QDRANT_API_KEY" > /dev/null 2>&1

  # Facet 지원 인덱스 생성 (lookup: true가 핵심)
  result=$(curl -s -X PUT "$QDRANT_URL/collections/$collection/index" \
    -H "api-key: $QDRANT_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "field_name": "document_id",
      "field_schema": {
        "type": "integer",
        "lookup": true,
        "range": false
      }
    }')

  status=$(echo "$result" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('status', 'error'))" 2>/dev/null)

  if [ "$status" = "ok" ]; then
    echo "완료"
    ((success++))
  else
    error=$(echo "$result" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('status', {}).get('error', 'unknown'))" 2>/dev/null)
    echo "실패 - $error"
    ((failed++))
  fi
done

echo ""
echo "=== 완료 ==="
echo "성공: $success, 실패: $failed"
echo ""

# Facet API 테스트
echo "=== Facet API 테스트 ==="
test_collection=$(echo "$collections" | head -1)
echo "테스트 컬렉션: $test_collection"

test_result=$(curl -s -X POST "$QDRANT_URL/collections/$test_collection/facet" \
  -H "api-key: $QDRANT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"key": "document_id", "exact": true, "limit": 100}')

facet_status=$(echo "$test_result" | python3 -c "import sys, json; d=json.load(sys.stdin); print('ok' if 'result' in d else d.get('status', {}).get('error', 'unknown'))" 2>/dev/null)

if [ "$facet_status" = "ok" ]; then
  hits=$(echo "$test_result" | python3 -c "import sys, json; d=json.load(sys.stdin); print(len(d.get('result', {}).get('hits', [])))" 2>/dev/null)
  echo "Facet API 정상 동작! 고유 문서 수: $hits"
else
  echo "Facet API 실패: $facet_status"
fi
