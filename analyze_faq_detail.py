import pandas as pd
import sys

# UTF-8 인코딩 설정
sys.stdout.reconfigure(encoding='utf-8')

# FAQ 파일 상세 분석
faq_path = r"D:\workspace\docling-app\docs\faq_topic.xlsx"

print("=" * 80)
print("FAQ 파일 상세 구조 분석")
print("=" * 80)

# Excel 파일 읽기
df = pd.read_excel(faq_path)

# 컬럼 정보
print(f"전체 컬럼 목록: {list(df.columns)}")
print(f"총 행 수: {len(df)}")
print()

# 각 컬럼의 데이터 샘플 확인
for col in df.columns:
    print(f"\n[{col}]")
    print(f"  - 데이터 타입: {df[col].dtype}")
    print(f"  - Non-null 개수: {df[col].notna().sum()}")
    print(f"  - Unique 값 개수: {df[col].nunique()}")

    # 샘플 데이터 표시 (처음 3개)
    print(f"  - 샘플 데이터:")
    for idx, val in enumerate(df[col].head(3)):
        if pd.notna(val):
            val_str = str(val)[:100] + "..." if len(str(val)) > 100 else str(val)
            print(f"    [{idx+1}] {val_str}")

# policy_anchor 관련 필드 찾기
print("\n" + "=" * 80)
print("근거 규정 관련 필드 검색")
print("=" * 80)
policy_cols = [col for col in df.columns if 'policy' in col.lower() or 'anchor' in col.lower() or '규정' in col or '근거' in col]
print(f"발견된 관련 컬럼: {policy_cols}")

# 전체 데이터 구조 미리보기
print("\n" + "=" * 80)
print("전체 데이터 미리보기 (처음 2행)")
print("=" * 80)
print(df.head(2).to_string())